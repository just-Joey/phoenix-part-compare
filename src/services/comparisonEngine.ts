import { claude } from "../lib/claude";
import type Anthropic from "@anthropic-ai/sdk";
import type { ComparisonResult } from "../types/comparison";

// Sonnet, not Haiku: this flow makes judgment calls (is this actually a
// close match, how significant is this spec difference) that the cheaper
// model handles less reliably. See specSearchEngine.ts for the split.
const CLAUDE_MODEL = "claude-sonnet-5";

// This tool definition is the whole trick: instead of asking Claude for prose
// and regex-parsing it, we give it a "submit_comparison" tool whose input
// schema IS our ComparisonResult type. Claude does the research (via the
// built-in web_search tool) and then calls this tool once with its findings.
// We never execute it server-side — we just read the arguments back out.
const SUBMIT_COMPARISON_TOOL = {
  name: "submit_comparison",
  description:
    "Submit the final structured comparison once research is complete. Call this exactly once, after using web search to verify specs and pricing for both parts.",
  input_schema: {
    type: "object" as const,
    properties: {
      phoenix: {
        type: ["object", "null"],
        properties: {
          manufacturer: { type: "string", const: "Phoenix Contact" },
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
        },
      },
      competitor: {
        type: ["object", "null"],
        properties: {
          manufacturer: { type: "string" },
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
        },
      },
      isCloseMatch: { type: "boolean" },
      similarities: { type: "array", items: { type: "string" } },
      differences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            phoenixValue: { type: "string" },
            competitorValue: { type: "string" },
            significance: { type: "string", enum: ["cosmetic", "minor", "major"] },
            note: { type: "string" },
          },
          required: ["field", "phoenixValue", "competitorValue", "significance", "note"],
        },
      },
      priceDelta: {
        type: "object",
        properties: {
          absoluteUsd: { type: ["number", "null"] },
          percent: { type: ["number", "null"] },
          note: { type: "string" },
        },
        required: ["absoluteUsd", "percent", "note"],
      },
      alternates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            manufacturer: { type: "string" },
            partNumber: { type: "string" },
            reason: { type: "string" },
          },
          required: ["manufacturer", "partNumber", "reason"],
        },
      },
      otherCandidates: {
        type: "array",
        description:
          "Other viable competitor brands/parts you considered besides the primary 'competitor' — e.g. if you picked Weidmüller as the closest match, list WAGO, Eaton, Schneider, etc. here if they also make a plausible equivalent. Populate this even when isCloseMatch is true.",
        items: {
          type: "object",
          properties: {
            manufacturer: { type: "string" },
            partNumber: { type: "string" },
            reason: { type: "string" },
          },
          required: ["manufacturer", "partNumber", "reason"],
        },
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      researchNotes: { type: "string" },
    },
    required: [
      "phoenix",
      "competitor",
      "isCloseMatch",
      "similarities",
      "differences",
      "priceDelta",
      "alternates",
      "otherCandidates",
      "confidence",
      "researchNotes",
    ],
  },
};

const SYSTEM_PROMPT = `You are a component research assistant for an industrial automation sales engineer.

You're given ONE of these starting points:
(a) a Phoenix Contact part number, optionally with a specific competitor part to compare against, or
(b) a competitor part number and its manufacturer, with no Phoenix Contact part known yet — a "reverse" search, where the job is to find the Phoenix Contact equivalent.

Regardless of which direction you're searching from, the output always has the same shape: "phoenix" is the Phoenix Contact part, "competitor" is the other brand's part — populate both fields correctly no matter which one was the starting point.

1. Research whichever part(s) you were given: full specs, contact/coil ratings, connection type, dimensions, certifications, and current street pricing from at least one distributor.
2. If the OTHER side (Phoenix or competitor, whichever wasn't given) wasn't specified, do NOT stop at the first plausible match you find. Industrial relay/terminal/connector categories like this are made by many overlapping brands — explicitly check at least 3-4 of: Weidmüller, WAGO, Eaton, Schneider Electric, ABB, Omron, IDEC, TE Connectivity, Finder, Rockwell/Allen-Bradley (when searching for a competitor equivalent to a given Phoenix part), or verify against Phoenix Contact's own catalog (when searching for the Phoenix equivalent to a given competitor part). Pick the closest overall match for the full comparison, and list other credible candidates you found (with their part numbers) in "otherCandidates" — populate this even when you're confident in your primary pick, so the sales engineer can see what else was considered.
3. If both parts were given, research both exactly, and still populate otherCandidates with a couple of other brands that make something comparable, for context.
4. Compare rigorously: only mark something a "similarity" if it's actually equivalent, not just superficially similar. Flag every spec difference, even small ones, and rate its practical significance.
5. Never fabricate a price. If you can't find a reliable price for a part, omit listPrice for that part rather than guessing — the priceDelta.note should say so explicitly.
6. If you can't find a close match at all, set isCloseMatch to false, leave the missing side null, and populate alternates instead with your best ranked suggestions and why each is worth considering.
7. Call submit_comparison exactly once, at the end, with your complete findings.

Be honest about uncertainty in researchNotes — e.g. "price is an estimate based on a sibling part number, not the exact SKU" or "no UL/CSA listing confirmed for this exact part."`;

export interface ComparisonEngineParams {
  phoenixPartNumber?: string;
  competitorPartNumber?: string;
  // Required for a reverse search (competitor part with no known Phoenix
  // match) — part numbering schemes overlap across brands, so without a
  // manufacturer name "2903308" is ambiguous about which catalog to check.
  competitorManufacturer?: string;
}

function buildUserPrompt(params: ComparisonEngineParams): string {
  const { phoenixPartNumber, competitorPartNumber, competitorManufacturer } = params;

  if (phoenixPartNumber && competitorPartNumber) {
    return `Compare Phoenix Contact part ${phoenixPartNumber} against competitor part ${competitorPartNumber}.`;
  }
  if (phoenixPartNumber) {
    return `Research Phoenix Contact part ${phoenixPartNumber} and find the closest competitor equivalent, then compare them.`;
  }
  if (competitorPartNumber) {
    const mfr = competitorManufacturer ? `${competitorManufacturer} part ${competitorPartNumber}` : `part ${competitorPartNumber} (manufacturer unspecified — identify it first)`;
    return `This is a reverse search: research ${mfr}, then find the closest Phoenix Contact equivalent and compare them. Populate "phoenix" with the Phoenix Contact match you find and "competitor" with the given part.`;
  }
  throw new Error("Either phoenixPartNumber or competitorPartNumber must be provided.");
}

export async function runComparisonEngine(
  params: ComparisonEngineParams,
  signal?: AbortSignal
): Promise<ComparisonResult> {
  const userPrompt = buildUserPrompt(params);

  const response = await claude.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        // Anthropic's server-side web search tool — no scraping infra needed here,
        // Claude runs the searches itself the same way it did in our manual research.
        { type: "web_search_20250305", name: "web_search" } as any,
        SUBMIT_COMPARISON_TOOL as any,
      ],
      messages: [{ role: "user", content: userPrompt }],
      // Let Claude decide how many searches it needs; we just cap total turns below.
    },
    // Passing the signal here is what makes cancellation actually stop the
    // expensive part (Claude + however many web searches it decides to run)
    // instead of just abandoning the response on the client side while the
    // server keeps burning tokens in the background.
    { signal }
  );

  const submission = extractSubmission(response);
  if (!submission) {
    throw new Error(
      "Comparison engine finished without calling submit_comparison — the model may have run out of turns. Consider raising max_tokens or looping additional turns."
    );
  }
  return submission;
}

function extractSubmission(message: Anthropic.Message): ComparisonResult | null {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === "submit_comparison") {
      return normalizeComparisonResult(block.input as ComparisonResult);
    }
  }
  return null;
}

// The submit_comparison tool's JSON schema marks most of these fields
// "required", but Anthropic's tool-use API doesn't actually enforce that for
// custom tools — Claude can and does omit them (seen so far: otherCandidates,
// then the entire priceDelta object), which used to crash the frontend since
// it renders straight off this shape with no guards. Defaulting every field
// here — not just the ones we've already been bitten by — keeps the
// contract with the client honest regardless of which one Claude drops next.
export function normalizeComparisonResult(result: ComparisonResult): ComparisonResult {
  return {
    ...result,
    isCloseMatch: result.isCloseMatch ?? false,
    similarities: result.similarities ?? [],
    differences: result.differences ?? [],
    priceDelta: {
      absoluteUsd: result.priceDelta?.absoluteUsd ?? null,
      percent: result.priceDelta?.percent ?? null,
      note: result.priceDelta?.note ?? "",
    },
    alternates: result.alternates ?? [],
    otherCandidates: result.otherCandidates ?? [],
    confidence: result.confidence ?? "low",
    researchNotes: result.researchNotes ?? "",
    phoenix: result.phoenix ? { ...result.phoenix, keySpecs: result.phoenix.keySpecs ?? {} } : null,
    competitor: result.competitor
      ? { ...result.competitor, keySpecs: result.competitor.keySpecs ?? {} }
      : null,
  };
}
