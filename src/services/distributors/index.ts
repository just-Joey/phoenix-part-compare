import type { DistributorAvailability } from "../../types/comparison";
import { graybarAdapter } from "./graybar";
import { thorpControlsAdapter } from "./thorpControls";
import { crumElectricAdapter } from "./crumElectric";
import { rsAmericasAdapter } from "./rsAmericas";
import type { DistributorAdapter } from "./types";
import { now } from "./types";

const ADAPTERS: DistributorAdapter[] = [
  graybarAdapter,
  thorpControlsAdapter,
  crumElectricAdapter,
  rsAmericasAdapter,
];

export async function checkAllDistributors(
  partNumber: string,
  signal?: AbortSignal
): Promise<DistributorAvailability[]> {
  // Promise.allSettled, not Promise.all — a bug in one adapter must never
  // take down the other three. Every adapter is already supposed to catch
  // its own errors internally, but this is the belt-and-suspenders backstop.
  const results = await Promise.allSettled(
    ADAPTERS.map((adapter) => adapter.check(partNumber, signal))
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;

    const adapter = ADAPTERS[i];
    return {
      distributor: adapter.id,
      partNumber,
      status: "error",
      quantity: null,
      unitPrice: null,
      leadTime: null,
      sourceUrl: null,
      method: "manual_link",
      checkedAt: now(),
      errorMessage: result.reason instanceof Error ? result.reason.message : String(result.reason),
    } satisfies DistributorAvailability;
  });
}
