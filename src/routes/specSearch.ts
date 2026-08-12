import { Router } from "express";
import { z } from "zod";
import { runSpecSearchEngine } from "../services/specSearchEngine";
import { getCachedSpecSearch, saveSpecSearch } from "../lib/cache";
import type { SpecSearchResponse } from "../types/comparison";

export const specSearchRouter = Router();

const SpecSearchRequestSchema = z.object({
  description: z.string().min(1),
  filters: z
    .object({
      category: z.string().optional(),
      voltage: z.string().optional(),
      contactConfig: z.string().optional(),
      connectionType: z.string().optional(),
      currentRating: z.string().optional(),
      mounting: z.string().optional(),
    })
    .optional(),
});

specSearchRouter.post("/spec-search", async (req, res) => {
  const parsed = SpecSearchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { description, filters } = parsed.data;

  // See the note in compare.ts: listening on `res`'s 'close' (not `req`'s)
  // and gating on writableEnded is what makes this actually only fire on a
  // genuine early client disconnect, rather than on every request.
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    let cached = true;
    let result = await getCachedSpecSearch(description, filters);
    if (!result) {
      cached = false;
      result = await runSpecSearchEngine(description, filters, controller.signal);
      await saveSpecSearch(description, filters, result);
    }

    const response: SpecSearchResponse = { result, cached };
    res.json(response);
  } catch (err) {
    // Deliberately not also checking req.destroyed — see compare.ts.
    if (res.writableEnded) return;

    // See compare.ts: check our own controller rather than the error's
    // name/type, since the Anthropic SDK's abort error isn't a plain
    // AbortError.
    const isAbort = controller.signal.aborted;
    console.error(isAbort ? "Spec search cancelled by client" : "Spec search failed:", err);
    res.status(isAbort ? 499 : 500).json({
      error: isAbort ? "Cancelled" : err instanceof Error ? err.message : "Unknown error running spec search",
    });
  }
});
