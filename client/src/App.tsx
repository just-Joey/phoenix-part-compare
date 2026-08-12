import { useRef, useState } from "react";
import { SearchForm } from "./components/SearchForm";
import { ReverseSearchForm } from "./components/ReverseSearchForm";
import { SpecSearchForm } from "./components/SpecSearchForm";
import { SpecSearchResults } from "./components/SpecSearchResults";
import { ComparisonResultView } from "./components/ComparisonResult";
import { DistributorAvailabilityList } from "./components/DistributorAvailability";
import { fetchComparison, fetchSpecSearch } from "./api";
import type { CompareResponse, SpecSearchFilters, SpecSearchResponse } from "./types";

type Mode = "part" | "reverse" | "specs";

interface CompareParams {
  phoenixPartNumber?: string;
  competitorPartNumber?: string;
  competitorManufacturer?: string;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("part");

  const [data, setData] = useState<CompareResponse | null>(null);
  const [specData, setSpecData] = useState<SpecSearchResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks whichever Phoenix part number the last successful comparison
  // actually resolved to — used for "compare instead" follow-ups. Read from
  // the RESULT rather than the request, because a reverse search doesn't
  // know the Phoenix part number until the engine finds it.
  const [lastPhoenixPart, setLastPhoenixPart] = useState("");

  // Kept in a ref rather than state: we need the current controller inside
  // the Cancel button's click handler without waiting for a re-render.
  const abortControllerRef = useRef<AbortController | null>(null);

  async function runSearch(params: CompareParams) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await fetchComparison(params, controller.signal);
      setData(result);
      if (result.comparison.phoenix?.partNumber) {
        setLastPhoenixPart(result.comparison.phoenix.partNumber);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }

  async function runSpecSearch(description: string, filters: SpecSearchFilters) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setData(null); // clear any previous detailed-compare result from a prior spec search
    try {
      const result = await fetchSpecSearch(description, filters, controller.signal);
      setSpecData(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    // Deliberately not clearing data/specData on mode switch — a rep
    // flipping back and forth shouldn't lose a result they just got.
  }

  return <div
  style={{
    maxWidth: 900,
    margin: "64px auto",
    padding: 32,
    border: "1px solid var(--border-offwhite)",
    borderRadius: 16,
  }}
>
      <h1 style={{ fontSize: 20 }}>Phoenix Contact part comparison</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className={mode === "part" ? "primary" : undefined} onClick={() => switchMode("part")}>
          By Phoenix part number
        </button>
        <button className={mode === "reverse" ? "primary" : undefined} onClick={() => switchMode("reverse")}>
          By competitor part number
        </button>
        <button className={mode === "specs" ? "primary" : undefined} onClick={() => switchMode("specs")}>
          By specs
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          {mode === "part" && (
            <SearchForm
              onSubmit={(phoenixPartNumber, competitorPartNumber) =>
                runSearch({ phoenixPartNumber, competitorPartNumber: competitorPartNumber || undefined })
              }
              loading={loading}
            />
          )}
          {mode === "reverse" && (
            <ReverseSearchForm
              onSubmit={(competitorManufacturer, competitorPartNumber, phoenixPartNumber) =>
                runSearch({
                  competitorManufacturer,
                  competitorPartNumber,
                  phoenixPartNumber: phoenixPartNumber || undefined,
                })
              }
              loading={loading}
            />
          )}
          {mode === "specs" && <SpecSearchForm onSubmit={runSpecSearch} loading={loading} />}
        </div>
        {loading && (
          <button className="danger" onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>

      {error && <div style={{ color: "var(--error)", marginTop: 16 }}>{error}</div>}

      {mode === "specs" && specData && (
        <div style={{ marginTop: 24 }}>
          {specData.cached && (
            <div className="text-secondary" style={{ marginBottom: 8 }}>
              (Loaded from cache)
            </div>
          )}
          <SpecSearchResults
            result={specData.result}
            onCompareSelected={(phoenixPartNumber, competitorPartNumber) =>
              runSearch({ phoenixPartNumber, competitorPartNumber })
            }
          />
        </div>
      )}

      {data && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {data.cached && (
            <div className="text-secondary">
              (Loaded from cache — spec research doesn't change often)
            </div>
          )}
          <ComparisonResultView
            result={data.comparison}
            onCompareInstead={(partNumber) =>
              lastPhoenixPart
                ? runSearch({ phoenixPartNumber: lastPhoenixPart, competitorPartNumber: partNumber })
                : undefined
            }
          />
          <div>
            <h2 style={{ fontSize: 16 }}>Distributor availability</h2>
            {data.availability.length > 0 ? (
              <DistributorAvailabilityList items={data.availability} />
            ) : (
              <div className="text-secondary">
                No Phoenix Contact part was resolved for this search, so distributor availability
                wasn't checked.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
}
