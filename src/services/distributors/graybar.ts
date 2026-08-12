import { createLinkOnlyAdapter } from "./linkOnlyAdapter";

// Graybar has no publicly documented catalog/pricing API — their EDI/API
// portal (apiportal-snd.graybar.com) is built for supplier-side integrations,
// not for a customer pulling live pricing. Third-party scraping-as-a-service
// products already exist specifically for Graybar, which is itself a signal
// that direct scraping isn't a lightweight lift. Link-out for now.
//
// NOTE: verify this search URL — confirm the query param name against a live
// search on graybar.com before relying on it (branch-specific pricing may
// also require being logged into a Graybar account tied to the Denver branch).
export const graybarAdapter = createLinkOnlyAdapter(
  "graybar_denver",
  "Graybar Denver",
  (partNumber) => `https://www.graybar.com/search?q=${encodeURIComponent(partNumber)}`
);
