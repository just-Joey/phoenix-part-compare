import type { DistributorAvailability } from "../../types/comparison";
import type { DistributorAdapter } from "./types";
import { now } from "./types";

// Why this exists: RS Americas and Graybar both actively block automated
// access (DataDome/Akamai-class bot protection), and Thorp Controls blocked
// our own fetch attempt during testing. Rather than build a scraper that
// will break, get your IP flagged, or edge into ToS-violating territory,
// this adapter just builds a direct, pre-filled search link and hands it
// back — the rep clicks through and checks stock themselves in a couple
// seconds. It's honest about what it is: status is always "link_only".
export function createLinkOnlyAdapter(
  id: DistributorAvailability["distributor"],
  displayName: string,
  buildSearchUrl: (partNumber: string) => string
): DistributorAdapter {
  return {
    id,
    displayName,
    async check(partNumber: string, _signal?: AbortSignal): Promise<DistributorAvailability> {
      return {
        distributor: id,
        partNumber,
        status: "link_only",
        quantity: null,
        unitPrice: null,
        leadTime: null,
        sourceUrl: buildSearchUrl(partNumber),
        method: "manual_link",
        checkedAt: now(),
      };
    },
  };
}
