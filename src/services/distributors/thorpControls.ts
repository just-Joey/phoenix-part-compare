import { createLinkOnlyAdapter } from "./linkOnlyAdapter";

// Thorp Controls (tcas.com) actually carries Phoenix Contact directly and has
// a normal-looking e-commerce catalog with query-param search — a plausible
// scraping target in principle. But a direct fetch attempt against it during
// development was bot-blocked, so treat that as unresolved rather than
// confirmed-safe. If you want to upgrade this to a real scraper:
//   1. Log into tcas.com from a real browser and run a manufacturer part
//      number search, confirm the resulting URL pattern.
//   2. Check robots.txt and terms of use before automating against it.
//   3. Test whether a headless browser (not a bare fetch) gets through —
//      some bot protection only blocks non-browser traffic.
// Until then, this stays link-out.
export const thorpControlsAdapter = createLinkOnlyAdapter(
  "thorp_controls",
  "Thorp Controls",
  (partNumber) =>
    `https://www.tcas.com/catalog/search?q=${encodeURIComponent(partNumber)}`
);
