import { createLinkOnlyAdapter } from "./linkOnlyAdapter";

// RS Americas (us.rs-online.com) runs DataDome/Akamai-class bot protection.
// Reliable automated access requires a paid anti-bot bypass service
// (residential proxies, managed headless rendering) — that's both a cost
// and a ToS gray area we're deliberately not building into a single-user
// internal tool. If RS pricing/stock becomes a frequent need, the better
// path is either (a) asking your RS rep about PunchOut/cXML trade access,
// or (b) a licensed parts-data aggregator API (e.g. oemsecrets.com, which
// already resells RS data legitimately) rather than scraping the site.
//
// NOTE: verify this search URL still works — RS changes storefront paths
// periodically. As of this writing the North American site search lives at
// /web/search with a searchTerm query param.
export const rsAmericasAdapter = createLinkOnlyAdapter(
  "rs_americas",
  "RS Americas",
  (partNumber) =>
    `https://us.rs-online.com/web/search?searchTerm=${encodeURIComponent(partNumber)}`
);
