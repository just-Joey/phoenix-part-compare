import * as cheerio from "cheerio";
import type { DistributorAvailability } from "../../types/comparison";
import type { DistributorAdapter } from "./types";
import { now } from "./types";

// Crum Electric (crum.com) is the best real scraping candidate of the four:
// it fetched cleanly with no bot-blocking during development and looks like
// a standard B2B storefront. That said, the SEARCH url and result markup
// below are a best guess, not confirmed against a live search — I could
// reach the homepage but didn't confirm the exact search results template.
// This adapter tries the scrape, and on ANY failure (wrong selector, no
// results, non-200, layout change) it falls back to a link-only result
// instead of throwing. That fallback is the important part: it means a
// selector going stale six months from now degrades this one distributor
// gracefully rather than crashing the whole comparison.
//
// TO HARDEN THIS: run a manual search on crum.com for a Phoenix Contact part
// number, inspect the results page HTML, and update SEARCH_URL_TEMPLATE and
// the cheerio selectors below to match what's actually there.

const SEARCH_URL_TEMPLATE = (partNumber: string) =>
  `https://www.crum.com/search?q=${encodeURIComponent(partNumber)}`;

export const crumElectricAdapter: DistributorAdapter = {
  id: "crum_electric",
  displayName: "Crum Electric Supply",

  async check(partNumber: string, signal?: AbortSignal): Promise<DistributorAvailability> {
    const searchUrl = SEARCH_URL_TEMPLATE(partNumber);

    try {
      const res = await fetch(searchUrl, {
        headers: {
          // A plain, honest user agent — not spoofing a browser. If Crum
          // wants to block scripted access they're entitled to, and this
          // adapter should fail closed (to link-only) rather than evade it.
          "User-Agent": "phoenix-part-compare/0.1 (internal sales tool)",
        },
        signal,
      });

      if (!res.ok) {
        return linkOnlyFallback(partNumber, searchUrl, `HTTP ${res.status}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Best-guess selectors for a typical product-tile grid. These are the
      // first thing to fix once you've seen the real markup.
      const firstResult = $(
        "[class*='product-tile'], [class*='product-item'], [class*='result-item']"
      ).first();

      if (firstResult.length === 0) {
        return linkOnlyFallback(partNumber, searchUrl, "no product tile found on results page");
      }

      const priceText = firstResult.find("[class*='price']").first().text().trim();
      const price = parsePrice(priceText);

      const stockText = firstResult.find("[class*='stock'], [class*='availability']").first().text().trim();
      const status = interpretStockText(stockText);

      return {
        distributor: "crum_electric",
        partNumber,
        status,
        quantity: null, // Crum doesn't expose exact quantity publicly as far as tested
        unitPrice: price,
        leadTime: null,
        sourceUrl: searchUrl,
        method: "scrape",
        checkedAt: now(),
      };
    } catch (err) {
      return linkOnlyFallback(
        partNumber,
        searchUrl,
        err instanceof Error ? err.message : "unknown error"
      );
    }
  },
};

function linkOnlyFallback(
  partNumber: string,
  sourceUrl: string,
  errorMessage: string
): DistributorAvailability {
  return {
    distributor: "crum_electric",
    partNumber,
    status: "unknown",
    quantity: null,
    unitPrice: null,
    leadTime: null,
    sourceUrl,
    method: "manual_link",
    checkedAt: now(),
    errorMessage,
  };
}

function parsePrice(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\d+(\.\d{1,2})?/);
  return match ? parseFloat(match[0]) : null;
}

function interpretStockText(text: string): DistributorAvailability["status"] {
  const t = text.toLowerCase();
  if (!t) return "unknown";
  if (t.includes("out of stock") || t.includes("unavailable")) return "out_of_stock";
  if (t.includes("in stock") || t.includes("available")) return "in_stock";
  return "unknown";
}
