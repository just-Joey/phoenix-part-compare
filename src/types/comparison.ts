// This is the contract between the comparison engine and the frontend.
// Keeping it as a fixed shape (rather than letting Claude return free text)
// is what makes the UI renderable without an LLM call on the display side too.

export interface PartSummary {
  manufacturer: string;
  partNumber: string;
  description: string;
  keySpecs: Record<string, string>;
  listPrice?: {
    amount: number;
    currency: string;
    asOf: string; // ISO date — pricing goes stale fast, always show this
    source: string; // e.g. "Digi-Key", "RS UK", "manufacturer eshop"
  };
}

export interface SpecDifference {
  field: string;
  phoenixValue: string;
  competitorValue: string;
  significance: "cosmetic" | "minor" | "major";
  note: string;
}

export interface Alternate {
  manufacturer: string;
  partNumber: string;
  reason: string;
}

export interface ComparisonResult {
  phoenix: PartSummary | null; // null when searching FROM a competitor part and no Phoenix equivalent was found
  competitor: PartSummary | null; // null when searching FROM a Phoenix part and no close competitor match was found
  isCloseMatch: boolean;
  similarities: string[];
  differences: SpecDifference[];
  priceDelta: {
    // Positive means the competitor is more expensive than Phoenix, negative means cheaper.
    // Left null when either price is unknown rather than guessing.
    absoluteUsd: number | null;
    percent: number | null;
    note: string;
  };
  alternates: Alternate[]; // populated when isCloseMatch is false, or on request
  confidence: "high" | "medium" | "low";
  researchNotes: string; // caveats, e.g. "price is an estimate from a sibling SKU"
}

// A follow-up lookup, run after a primary Phoenix Contact part is already
// selected — never other manufacturers, since that's the whole point of this
// existing only for Phoenix Contact parts (this business doesn't sell
// anything else). Kept out of ComparisonResult itself: it's a separate,
// on-demand action from the client rather than bundled into every compare.
export interface NextBestPhoenixPart {
  manufacturer: "Phoenix Contact";
  partNumber: string;
  description: string;
  keySpecs: Record<string, string>;
  listPrice?: {
    amount: number;
    currency: string;
    asOf: string;
    source: string;
  };
  reason: string; // why this is worth considering instead of (or alongside) the primary part
}

export interface NextBestPhoenixPartsRequest {
  phoenixPartNumber: string; // the already-selected primary part
}

export interface NextBestPhoenixPartsResult {
  candidates: NextBestPhoenixPart[]; // ranked, strongest alternate first
  searchNotes: string;
}

export interface NextBestPhoenixPartsResponse {
  result: NextBestPhoenixPartsResult;
  cached: boolean;
}

export type DistributorId =
  | "graybar_denver"
  | "thorp_controls"
  | "crum_electric"
  | "rs_americas";

export type CheckMethod = "scrape" | "manual_link" | "api";

export interface DistributorAvailability {
  distributor: DistributorId;
  partNumber: string;
  status: "in_stock" | "out_of_stock" | "unknown" | "link_only" | "error";
  quantity: number | null;
  unitPrice: number | null;
  leadTime: string | null;
  sourceUrl: string | null;
  method: CheckMethod;
  checkedAt: string; // ISO timestamp
  errorMessage?: string;
}

export interface CompareRequest {
  phoenixPartNumber: string;
  competitorPartNumber?: string; // optional — if omitted, the engine finds one
  checkAvailability?: boolean; // default true
}

export interface CompareResponse {
  comparison: ComparisonResult;
  availability: DistributorAvailability[];
  cached: boolean;
}

// --- Spec-based search ---
// A separate flow from part-number comparison: no anchor part, so the output
// is a ranked list of candidates across manufacturers rather than a single
// phoenix-vs-competitor pair. The user picks two candidates from the list —
// one of which must be a Phoenix Contact part — to hand off into the
// existing CompareRequest flow for a full detailed comparison.

export interface SpecSearchFilters {
  category?: string; // e.g. "relay module", "terminal block", "connector", "power supply"
  voltage?: string; // e.g. "24VDC"
  contactConfig?: string; // e.g. "4CO", "SPDT"
  connectionType?: string; // e.g. "push-in", "screw", "spring"
  currentRating?: string; // e.g. "5A", "6A+"
  mounting?: string; // e.g. "DIN rail"
}

export interface SpecSearchRequest {
  description: string;
  filters?: SpecSearchFilters;
}

export interface SpecSearchCandidate extends PartSummary {
  matchScore: "strong" | "partial" | "weak";
  matchNotes: string; // why this fits (or doesn't fully fit) the described need
}

export interface SpecSearchResult {
  candidates: SpecSearchCandidate[];
  searchNotes: string; // e.g. "no exact 6A push-in match found in this configuration; closest options shown"
}

export interface SpecSearchResponse {
  result: SpecSearchResult;
  cached: boolean;
}
