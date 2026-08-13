import type { CompareResponse, SpecSearchFilters, SpecSearchResponse } from "./types";
import { getAuthToken } from "./auth";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function authHeader(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchComparison(
  params: {
    phoenixPartNumber?: string;
    competitorPartNumber?: string;
    competitorManufacturer?: string;
  },
  signal?: AbortSignal
): Promise<CompareResponse> {
  const res = await fetch(`${API_BASE}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.toString() ?? `Request failed with ${res.status}`);
  }

  return res.json();
}

export async function fetchSpecSearch(
  description: string,
  filters: SpecSearchFilters,
  signal?: AbortSignal
): Promise<SpecSearchResponse> {
  // Strip empty-string filter values rather than sending them — an empty
  // "voltage: ''" would otherwise read as a real constraint to the engine.
  const cleanedFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v && v.trim())
  );

  const res = await fetch(`${API_BASE}/api/spec-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({
      description,
      filters: Object.keys(cleanedFilters).length > 0 ? cleanedFilters : undefined,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.toString() ?? `Request failed with ${res.status}`);
  }

  return res.json();
}
