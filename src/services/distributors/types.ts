import type { DistributorAvailability } from "../../types/comparison";

// Every adapter implements this one function. The contract: NEVER throw for
// "couldn't find it" or "site blocked us" — catch internally and return a
// status of "unknown" or "error" instead, so one flaky distributor never
// takes down the other three. Only let truly unexpected bugs throw.
export interface DistributorAdapter {
  id: DistributorAvailability["distributor"];
  displayName: string;
  check(partNumber: string, signal?: AbortSignal): Promise<DistributorAvailability>;
}

export function now(): string {
  return new Date().toISOString();
}
