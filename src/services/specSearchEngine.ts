import { claude, CLAUDE_MODEL } from "../lib/claude";
import type Anthropic from "@anthropic-ai/sdk";
import type { SpecSearchFilters, SpecSearchResult } from "../types/comparison";

const SUBMIT_SPEC_SEARCH_TOOL = {
  name: "submit_spec_search",
  description:
    "Submit the ranked list of candidate parts once research is complete. Call this exactly once, after using web search to find real parts matching the described need.",
  input_schema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "array",
        description:
          "3-8 ranked candidates across multiple manufacturers, strongest match first. Include Phoenix Contact options where they exist, but don't force one in if it isn't a good fit.",
        items: {
          type: "object",
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
            matchScore: { type: "string", enum: ["strong", "partial", "weak"] },
            matchNotes: {
              type: "string",
              description: "Why this fits (or where it falls short of) the described need.",
            },
          },
          required: ["manufacturer", "partNumber", "description", "keySpecs", "matchScore", "matchNotes"],
        },
      },
      searchNotes: {
        type: "string",
        description:
          "Overall notes on the search — e.g. no exact match found for X, closest options shown, or a criterion was ambiguous and how you interpreted it.",
      },
    },
    required: ["candidates", "searchNotes"],
  },
};

const SYSTEM_PROMPT = `You are a component research assistant for an industrial automation sales engineer.

The engineer will describe a need in their own words, sometimes with structured filters attached (category, voltage, contact configuration, connection type, current rating, mounting). You do NOT start from a known part number — your job is to find real, currently-manufactured parts across multiple brands that plausibly fit.

1. Read the free-text description as the primary source of truth. Treat any structured filters as hard constraints to narrow against, not decoration — if a filter says "24VDC" don't return a 12VDC part unless nothing else qualifies, and say so in matchNotes.
2. Search across brands: Phoenix Contact, Weidmüller, WAGO, Eaton, Schneider Electric, ABB, Omron, IDEC, TE Connectivity, Finder, Rockwell/Allen-Bradley — whichever are actually relevant to the category described. Don't artificially favor Phoenix Contact; include it only where it's a genuine fit.
3. Return 3-8 ranked candidates, strongest match first, each with a matchScore and a plain-language matchNotes explaining the fit or the compromise.
4. Never fabricate a price — omit listPrice for a candidate rather than guessing.
5. If nothing matches well, say so honestly in searchNotes and still return the closest available options with weak matchScores rather than an empty list.
6. Call submit_spec_search exactly once, at the end, with your complete findings.`;

export async function runSpecSearchEngine(
  description: string,
  filters: SpecSearchFilters | undefined,
  signal?: AbortSignal
): Promise<SpecSearchResult> {
  const filterLines = filters
    ? Object.entries(filters)
        .filter(([, v]) => v)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "";

  const userPrompt = [
    `Find parts matching this need: ${description}`,
    filterLines ? `\nAdditional constraints:\n${filterLines}` : "",
  ].join("");

  const response = await claude.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        { type: "web_search_20250305", name: "web_search" } as any,
        SUBMIT_SPEC_SEARCH_TOOL as any,
      ],
      messages: [{ role: "user", content: userPrompt }],
    },
    { signal }
  );

  const submission = extractSubmission(response);
  if (!submission) {
    throw new Error(
      "Spec search finished without calling submit_spec_search — the model may have run out of turns."
    );
  }
  return submission;
}

function extractSubmission(message: Anthropic.Message): SpecSearchResult | null {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === "submit_spec_search") {
      return block.input as SpecSearchResult;
    }
  }
  return null;
}
