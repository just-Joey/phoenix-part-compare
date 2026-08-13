import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import type {
  ComparisonResult,
  DistributorAvailability,
  SpecSearchFilters,
  SpecSearchResult,
} from "../types/comparison";
import { normalizeComparisonResult } from "../services/comparisonEngine";
import { normalizeSpecSearchResult } from "../services/specSearchEngine";

export const prisma = new PrismaClient();

const COMPARISON_CACHE_DAYS = Number(process.env.COMPARISON_CACHE_DAYS ?? 14);
const AVAILABILITY_CACHE_HOURS = Number(process.env.AVAILABILITY_CACHE_HOURS ?? 6);
// Shorter than the part-number cache on purpose: free-text spec searches are
// exploratory by nature (a rep iterating on wording), and a stale ranked
// list is more actively misleading than a stale single spec sheet.
const SPEC_SEARCH_CACHE_DAYS = Number(process.env.SPEC_SEARCH_CACHE_DAYS ?? 3);

export interface ComparisonCacheParams {
  phoenixPartNumber?: string;
  competitorPartNumber?: string;
  competitorManufacturer?: string; // present on reverse searches
}

function cacheKeyFor(params: ComparisonCacheParams) {
  // Normalized so "abc123" and "ABC-123" don't create duplicate cache rows.
  const normalize = (s: string) => s.trim().toUpperCase().replace(/[\s-]/g, "");
  return [
    params.phoenixPartNumber ? normalize(params.phoenixPartNumber) : "",
    params.competitorPartNumber ? normalize(params.competitorPartNumber) : "",
    params.competitorManufacturer ? normalize(params.competitorManufacturer) : "",
  ].join("|");
}

export async function getCachedComparison(params: ComparisonCacheParams) {
  const cacheKey = cacheKeyFor(params);
  const row = await prisma.comparison.findUnique({ where: { cacheKey } });
  if (!row) return null;

  const ageMs = Date.now() - row.updatedAt.getTime();
  const maxAgeMs = COMPARISON_CACHE_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) return null; // stale — caller should re-run the engine

  return { id: row.id, result: normalizeComparisonResult(row.result as unknown as ComparisonResult) };
}

export async function saveComparison(params: ComparisonCacheParams, result: ComparisonResult) {
  const cacheKey = cacheKeyFor(params);
  return prisma.comparison.upsert({
    where: { cacheKey },
    create: {
      // Store the resolved part numbers from the actual result where
      // available (more informative for anyone reading the DB directly),
      // falling back to whatever was in the original request.
      phoenixPartNumber: result.phoenix?.partNumber ?? params.phoenixPartNumber,
      competitorPartNumber: result.competitor?.partNumber ?? params.competitorPartNumber,
      competitorManufacturer: params.competitorManufacturer,
      cacheKey,
      result: result as any,
    },
    update: {
      result: result as any,
    },
  });
}

export async function getCachedAvailability(
  comparisonId: string
): Promise<DistributorAvailability[] | null> {
  const rows = await prisma.distributorCheck.findMany({ where: { comparisonId } });
  if (rows.length === 0) return null;

  const maxAgeMs = AVAILABILITY_CACHE_HOURS * 60 * 60 * 1000;
  const freshRows = rows.filter((r: any) => Date.now() - r.checkedAt.getTime() < maxAgeMs);

  // If even one distributor's data is stale, treat the whole set as stale —
  // simpler than partial refresh, and availability checks are cheap enough
  // to just re-run all four together.
  if (freshRows.length !== rows.length) return null;

  // Typed `any` here rather than the generated Prisma row type: this sandbox
  // couldn't reach binaries.prisma.sh to run `prisma generate`, so the real
  // DistributorCheck type isn't available yet. Run `npx prisma generate`
  // locally (see README) and this will typecheck against the real model.
  return rows.map((r: any) => ({
    distributor: r.distributor as DistributorAvailability["distributor"],
    partNumber: r.partNumber,
    status: r.status as DistributorAvailability["status"],
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    leadTime: r.leadTime,
    sourceUrl: r.sourceUrl,
    method: r.method as DistributorAvailability["method"],
    checkedAt: r.checkedAt.toISOString(),
  }));
}

export async function saveAvailability(
  comparisonId: string,
  checks: DistributorAvailability[]
) {
  // Simple approach for a single-user tool: wipe and re-insert rather than
  // diffing. Volume here is tiny (4 rows per comparison) so this is fine.
  await prisma.distributorCheck.deleteMany({ where: { comparisonId } });
  await prisma.distributorCheck.createMany({
    data: checks.map((c) => ({
      comparisonId,
      distributor: c.distributor,
      partNumber: c.partNumber,
      status: c.status,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      leadTime: c.leadTime,
      sourceUrl: c.sourceUrl,
      method: c.method,
    })),
  });
}

function specSearchCacheKey(description: string, filters?: SpecSearchFilters) {
  // Hashed rather than used raw as the unique key: free text can be long and
  // contain characters that don't belong in a DB unique index cleanly.
  const normalizedDescription = description.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedFilters = filters
    ? Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v)
          .map(([k, v]) => [k, String(v).trim().toLowerCase()])
      )
    : {};
  const payload = JSON.stringify({ d: normalizedDescription, f: normalizedFilters });
  return createHash("sha256").update(payload).digest("hex");
}

export async function getCachedSpecSearch(
  description: string,
  filters?: SpecSearchFilters
): Promise<SpecSearchResult | null> {
  const cacheKey = specSearchCacheKey(description, filters);
  const row = await prisma.specSearch.findUnique({ where: { cacheKey } });
  if (!row) return null;

  const ageMs = Date.now() - row.updatedAt.getTime();
  const maxAgeMs = SPEC_SEARCH_CACHE_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) return null;

  return normalizeSpecSearchResult(row.result as unknown as SpecSearchResult);
}

export async function saveSpecSearch(
  description: string,
  filters: SpecSearchFilters | undefined,
  result: SpecSearchResult
) {
  const cacheKey = specSearchCacheKey(description, filters);
  return prisma.specSearch.upsert({
    where: { cacheKey },
    create: {
      description,
      filters: (filters ?? {}) as any,
      cacheKey,
      result: result as any,
    },
    update: {
      result: result as any,
    },
  });
}
