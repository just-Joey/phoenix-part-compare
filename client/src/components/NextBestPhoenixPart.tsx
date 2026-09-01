import { useState } from "react";
import { fetchNextBestPhoenixPart } from "../api";
import type { NextBestPhoenixPart } from "../types";

interface Props {
  // The already-resolved primary Phoenix part from the comparison above —
  // this is a follow-up lookup keyed on it, not bundled into that request.
  primaryPartNumber: string;
  // Re-runs the primary compare against this part instead.
  onSelect: (partNumber: string) => void;
}

export function NextBestPhoenixPartSection({ primaryPartNumber, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ candidates: NextBestPhoenixPart[]; searchNotes: string; cached: boolean } | null>(null);

  async function handleFind() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNextBestPhoenixPart(primaryPartNumber);
      setResult({ ...res.result, cached: res.cached });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 16 }}>Next best Phoenix Contact part</h2>
      {!result && (
        <button onClick={handleFind} disabled={loading}>
          {loading ? "Researching…" : `Find next best alternate to ${primaryPartNumber}`}
        </button>
      )}

      {error && <div style={{ color: "var(--error)", marginTop: 8 }}>{error}</div>}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {result.cached && <div className="text-secondary">(Loaded from cache)</div>}
          {result.candidates.length === 0 ? (
            <div className="text-secondary">
              {result.searchNotes || "No good Phoenix Contact alternate found."}
            </div>
          ) : (
            <>
              {result.searchNotes && <div className="text-secondary">{result.searchNotes}</div>}
              {result.candidates.map((c, i) => (
                <div
                  key={i}
                  className="card"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                >
                  <div>
                    <div>{c.manufacturer} {c.partNumber}</div>
                    <div className="text-secondary">{c.description}</div>
                    <div className="text-secondary">{c.reason}</div>
                    {c.listPrice && (
                      <div style={{ marginTop: 4 }}>
                        {c.listPrice.currency} {c.listPrice.amount.toFixed(2)}
                        <span className="text-secondary"> ({c.listPrice.source}, as of {c.listPrice.asOf})</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => onSelect(c.partNumber)}>Use this instead</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
