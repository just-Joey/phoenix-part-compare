import { claude } from "../lib/claude";
import type Anthropic from "@anthropic-ai/sdk";
import type { NextBestPhoenixPart, NextBestPhoenixPartsResult } from "../types/comparison";

// Haiku, not Sonnet: like specSearchEngine.ts, this is mostly a lookup/ranking
// task against Phoenix Contact's own catalog, not the sharper judgment calls
// comparisonEngine.ts needs.
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// Note there's no "manufacturer" field in this schema at all, unlike
// comparisonEngine's competitor object — this business only ever sells
// Phoenix Contact parts, so rather than trust a prompt instruction to keep
// Claude from suggesting another brand, normalizeNextBestPhoenixPartsResult
// hardcodes "Phoenix Contact" below. There's no field for Claude to get wrong.
const SUBMIT_NEXT_BEST_PARTS_TOOL = {
  name: "submit_next_best_parts",
  description:
    "Submit ranked Phoenix Contact alternates to the primary part once research is complete. Call this exactly once, after using web search to verify the primary part and its alternates.",
  input_schema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "array",
        description:
          "1-4 ranked Phoenix Contact parts worth having in mind if the primary pick is unavailable, discontinued, or not quite the right fit — e.g. a successor SKU, a close substitute within the same series, or a different Phoenix Contact series that fits the same application. Strongest alternate first. Never a part from another manufacturer.",
        items: {
          type: "object",
          properties: {
            partNumber: { type: "string" },
            description: { type: "string" },
            keySpecs: { type: "object", additionalProperties: { type: "string" } },
            listPrice: {
              type: "object",
              properties: {
                amount: { type: "number" },
                currency: { type: "string" },
                asOf: { type: "string" },
                source: { type: "string" },
              },
            },
            reason: {
              type: "string",
              description: "Why this is worth considering instead of (or alongside) the primary part.",
            },
          },
          required: ["partNumber", "description", "keySpecs", "reason"],
        },
      },
      searchNotes: { type: "string" },
    },
    required: ["candidates", "searchNotes"],
  },
};

const SYSTEM_PROMPT = `You are a component research assistant for a Phoenix Contact sales engineer. This company sells Phoenix Contact parts exclusively — never suggest or research a part from any other manufacturer.

You're given a Phoenix Contact part number the engineer has already selected as their primary pick. Your job is to find the next-best Phoenix Contact alternate(s) — parts worth having in mind in case the primary pick is out of stock, discontinued, or not quite the right fit.

1. Research the primary part first: its full specs and category, so you know what you're finding an alternate to.
2. Search Phoenix Contact's own catalog for 1-4 credible alternates: a direct successor/replacement SKU if the primary is older or being phased out, a close substitute within the same series with minor spec differences, or a different Phoenix Contact series/product line that fits the same application. Rank strongest alternate first.
3. For each candidate, explain in "reason" why it's worth considering — e.g. "same DIN-rail relay module, but push-in instead of screw terminals" or "successor to the primary part per Phoenix Contact's migration guide."
4. Never fabricate a price. If you can't find a reliable price for a candidate, omit listPrice for it rather than guessing.
5. If you can't find any good alternate, return an empty candidates array and say why in searchNotes rather than forcing a weak suggestion.
6. Call submit_next_best_parts exactly once, at the end, with your complete findings.`;

export interface NextBestPhoenixPartsEngineParams {
  phoenixPartNumber: string;
}

export async function runNextBestPhoenixPartsEngine(
  params: NextBestPhoenixPartsEngineParams,
  signal?: AbortSignal
): Promise<NextBestPhoenixPartsResult> {
  const userPrompt = `Find the next-best Phoenix Contact alternate(s) to Phoenix Contact part ${params.phoenixPartNumber}.`;

  const response = await claude.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        { type: "web_search_20250305", name: "web_search" } as any,
        SUBMIT_NEXT_BEST_PARTS_TOOL as any,
      ],
      messages: [{ role: "user", content: userPrompt }],
    },
    { signal }
  );

  const submission = extractSubmission(response);
  if (!submission) {
    throw new Error(
      "Next-best-parts engine finished without calling submit_next_best_parts — the model may have run out of turns."
    );
  }
  return submission;
}

function extractSubmission(message: Anthropic.Message): NextBestPhoenixPartsResult | null {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === "submit_next_best_parts") {
      return normalizeNextBestPhoenixPartsResult(block.input as { candidates?: Partial<NextBestPhoenixPart>[]; searchNotes?: string });
    }
  }
  return null;
}

// Same class of gap as comparisonEngine.ts's normalizeComparisonResult:
// "required" in the tool schema isn't actually enforced by the API.
export function normalizeNextBestPhoenixPartsResult(result: {
  candidates?: Partial<NextBestPhoenixPart>[];
  searchNotes?: string;
}): NextBestPhoenixPartsResult {
  return {
    searchNotes: result.searchNotes ?? "",
    candidates: (result.candidates ?? []).map((c) => ({
      manufacturer: "Phoenix Contact",
      partNumber: c.partNumber ?? "",
      description: c.description ?? "",
      keySpecs: c.keySpecs ?? {},
      listPrice: c.listPrice,
      reason: c.reason ?? "",
    })),
  };
}
