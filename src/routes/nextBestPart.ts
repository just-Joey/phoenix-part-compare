import { Router } from "express";
import { z } from "zod";
import { runNextBestPhoenixPartsEngine } from "../services/nextBestPhoenixPartsEngine";
import { getCachedNextBestPhoenixParts, saveNextBestPhoenixParts } from "../lib/cache";
import type { NextBestPhoenixPartsResponse } from "../types/comparison";

export const nextBestPartRouter = Router();

const NextBestPartRequestSchema = z.object({
  phoenixPartNumber: z.string().min(1),
});

nextBestPartRouter.post("/next-best-part", async (req, res) => {
  const parsed = NextBestPartRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { phoenixPartNumber } = parsed.data;

  // See the note in compare.ts: listening on `res`'s 'close' (not `req`'s)
  // and gating on writableEnded is what makes this actually only fire on a
  // genuine early client disconnect, rather than on every request.
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    let cached = true;
    let result = await getCachedNextBestPhoenixParts(phoenixPartNumber);
    if (!result) {
      cached = false;
      result = await runNextBestPhoenixPartsEngine({ phoenixPartNumber }, controller.signal);
      await saveNextBestPhoenixParts(phoenixPartNumber, result);
    }

    const response: NextBestPhoenixPartsResponse = { result, cached };
    res.json(response);
  } catch (err) {
    // Deliberately not also checking req.destroyed — see compare.ts.
    if (res.writableEnded) return;

    // See compare.ts: check our own controller rather than the error's
    // name/type, since the Anthropic SDK's abort error isn't a plain
    // AbortError.
    const isAbort = controller.signal.aborted;
    console.error(isAbort ? "Next-best-part search cancelled by client" : "Next-best-part search failed:", err);
    res.status(isAbort ? 499 : 500).json({
      error: isAbort ? "Cancelled" : err instanceof Error ? err.message : "Unknown error finding the next-best part",
    });
  }
});
