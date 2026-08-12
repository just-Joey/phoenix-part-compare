// Mirrors src/types/comparison.ts on the backend. Duplicated rather than
// shared via a workspace package to keep this a simple two-folder project —
// if the backend type changes, update this file to match. See README.

export interface PartSummary {
  manufacturer: string;
  partNumber: string;
  description: string;
  keySpecs: Record<string, string>;
  listPrice?: {
    amount: number;
    currency: string;
    asOf: string;
    source: string;
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
  phoenix: PartSummary | null;
  competitor: PartSummary | null;
  isCloseMatch: boolean;
  similarities: string[];
  differences: SpecDifference[];
  priceDelta: {
    absoluteUsd: number | null;
    percent: number | null;
    note: string;
  };
  alternates: Alternate[];
  otherCandidates: Alternate[];
  confidence: "high" | "medium" | "low";
  researchNotes: string;
}

export type DistributorId =
  | "graybar_denver"
  | "thorp_controls"
  | "crum_electric"
  | "rs_americas";

export interface DistributorAvailability {
  distributor: DistributorId;
  partNumber: string;
  status: "in_stock" | "out_of_stock" | "unknown" | "link_only" | "error";
  quantity: number | null;
  unitPrice: number | null;
  leadTime: string | null;
  sourceUrl: string | null;
  method: "scrape" | "manual_link" | "api";
  checkedAt: string;
  errorMessage?: string;
}

export interface CompareResponse {
  comparison: ComparisonResult;
  availability: DistributorAvailability[];
  cached: boolean;
}

export interface SpecSearchFilters {
  category?: string;
  voltage?: string;
  contactConfig?: string;
  connectionType?: string;
  currentRating?: string;
  mounting?: string;
}

export interface SpecSearchCandidate extends PartSummary {
  matchScore: "strong" | "partial" | "weak";
  matchNotes: string;
}

export interface SpecSearchResult {
  candidates: SpecSearchCandidate[];
  searchNotes: string;
}

export interface SpecSearchResponse {
  result: SpecSearchResult;
  cached: boolean;
}
