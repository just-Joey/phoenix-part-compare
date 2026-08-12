import { Router } from "express";
import { z } from "zod";
import { runComparisonEngine } from "../services/comparisonEngine";
import { checkAllDistributors } from "../services/distributors";
import {
  getCachedComparison,
  saveComparison,
  getCachedAvailability,
  saveAvailability,
} from "../lib/cache";
import type { CompareResponse, DistributorAvailability } from "../types/comparison";

export const compareRouter = Router();

const CompareRequestSchema = z
  .object({
    phoenixPartNumber: z.string().min(1).optional(),
    competitorPartNumber: z.string().min(1).optional(),
    // Required for a reverse search — see note in comparisonEngine.ts on why
    // a bare competitor part number is ambiguous without knowing the brand.
    competitorManufacturer: z.string().min(1).optional(),
    checkAvailability: z.boolean().optional().default(true),
  })
  .refine((data) => !!data.phoenixPartNumber || !!data.competitorPartNumber, {
    message: "Provide at least a Phoenix Contact part number or a competitor part number.",
  })
  .refine((data) => !!data.phoenixPartNumber || !!data.competitorManufacturer, {
    message: "A reverse search (competitor part with no known Phoenix part) needs the competitor's manufacturer name.",
  });

compareRouter.post("/compare", async (req, res) => {
  const parsed = CompareRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { phoenixPartNumber, competitorPartNumber, competitorManufacturer, checkAvailability } = parsed.data;
  const cacheParams = { phoenixPartNumber, competitorPartNumber, competitorManufacturer };

  // This is what makes the frontend's Cancel button actually stop work,
  // rather than just abandoning the response while the server keeps
  // researching in the background. Deliberately listening on the RESPONSE's
  // 'close' event, not the request's: `req`'s 'close' fires as soon as the
  // request body has been fully read, which happens almost immediately on
  // every request regardless of whether the client is still around — using
  // that would abort the Claude call before it even starts. `res` only
  // closes once the client actually disconnects or the response finishes,
  // and checking writableEnded tells apart "client disconnected early"
  // (abort) from "we already finished responding" (no-op).
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    // Step 1: comparison result, from cache if fresh, otherwise run the engine.
    const cachedComparison = await getCachedComparison(cacheParams);

    // When the Phoenix part number is already known up front (i.e. this
    // isn't a reverse search), we don't need to wait for the comparison
    // step to resolve just to learn what to check distributors for — kick
    // that off now, in parallel with the comparison engine's slow web-search
    // round trip (or the cheap cache-hit bookkeeping below), instead of
    // waiting for step 1 to fully finish first.
    let eagerAvailability: Promise<{ availability: DistributorAvailability[]; live: boolean }> | null = null;
    if (checkAvailability && phoenixPartNumber) {
      eagerAvailability = (async () => {
        const cachedRows = cachedComparison ? await getCachedAvailability(cachedComparison.id) : null;
        if (cachedRows) return { availability: cachedRows, live: false };
        const live = await checkAllDistributors(phoenixPartNumber, controller.signal);
        return { availability: live, live: true };
      })();
    }

    let cached = false;
    let comparisonId: string;
    let result = cachedComparison?.result;

    if (result) {
      cached = true;
      const row = await saveComparison(cacheParams, result);
      comparisonId = row.id;
    } else {
      result = await runComparisonEngine(
        { phoenixPartNumber, competitorPartNumber, competitorManufacturer },
        controller.signal
      );
      const row = await saveComparison(cacheParams, result);
      comparisonId = row.id;
    }

    // Step 2: distributor availability, independently cached and independently
    // fresh — pricing goes stale much faster than specs do. Checked against
    // the RESOLVED Phoenix part number from the result, not the raw request —
    // in a reverse search the request might not have had one at all.
    const resolvedPhoenixPartNumber = result.phoenix?.partNumber;
    let availability: DistributorAvailability[] = [];
    if (checkAvailability && resolvedPhoenixPartNumber) {
      if (eagerAvailability && resolvedPhoenixPartNumber === phoenixPartNumber) {
        const eager = await eagerAvailability;
        availability = eager.availability;
        if (eager.live) await saveAvailability(comparisonId, availability);
      } else {
        // Either a reverse search (no Phoenix part number known up front) or
        // the engine resolved a different one than what was given — we
        // couldn't have known what to check for eagerly, so fall back to the
        // normal cached-then-live sequence.
        const cachedRows = await getCachedAvailability(comparisonId);
        availability = cachedRows ?? (await checkAllDistributors(resolvedPhoenixPartNumber, controller.signal));
        if (!cachedRows) await saveAvailability(comparisonId, availability);
      }
    }

    const response: CompareResponse = {
      comparison: result,
      availability: availability ?? [],
      cached,
    };
    res.json(response);
  } catch (err) {
    // If we already sent a response, there's nothing left to do — trying
    // again would just throw a second, noisier error. Deliberately NOT also
    // checking req.destroyed here: the request's readable side is done (and
    // so "destroyed") as soon as its body has been read, on every request,
    // whether or not the client is still around — checking it would silently
    // swallow real errors instead of reporting them.
    if (res.writableEnded) return;

    // Checking our own controller rather than the error's name/type: the
    // Anthropic SDK wraps an abort as APIUserAbortError, not the plain
    // AbortError a bare fetch() would throw, so matching on err.name misses
    // it. Whether *we* asked for the abort is the thing that actually
    // matters here.
    const isAbort = controller.signal.aborted;
    console.error(isAbort ? "Comparison cancelled by client" : "Comparison failed:", err);
    res.status(isAbort ? 499 : 500).json({
      error: isAbort ? "Cancelled" : err instanceof Error ? err.message : "Unknown error running comparison",
    });
  }
});
