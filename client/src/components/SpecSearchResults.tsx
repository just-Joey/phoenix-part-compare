import { useState } from "react";
import type { SpecSearchResult, SpecSearchCandidate } from "../types";

const MATCH_LABEL: Record<SpecSearchCandidate["matchScore"], string> = {
  strong: "Strong match",
  partial: "Partial match",
  weak: "Weak match",
};

function isPhoenixContact(manufacturer: string) {
  return manufacturer.trim().toLowerCase() === "phoenix contact";
}

interface Props {
  result: SpecSearchResult;
  // Called with (phoenixPartNumber, competitorPartNumber) once the user has
  // picked exactly two candidates, one of which is a Phoenix Contact part —
  // that's the existing detailed-comparison flow's requirement.
  onCompareSelected: (phoenixPartNumber: string, competitorPartNumber: string) => void;
}

export function SpecSearchResults({ result, onCompareSelected }: Props) {
  const [selected, setSelected] = useState<string[]>([]); // part numbers

  function toggle(partNumber: string) {
    setSelected((prev) => {
      if (prev.includes(partNumber)) return prev.filter((p) => p !== partNumber);
      if (prev.length >= 2) return [prev[1], partNumber]; // keep it to 2, drop the oldest
      return [...prev, partNumber];
    });
  }

  const selectedCandidates = result.candidates.filter((c) => selected.includes(c.partNumber));
  const phoenixPick = selectedCandidates.find((c) => isPhoenixContact(c.manufacturer));
  const otherPick = selectedCandidates.find((c) => !isPhoenixContact(c.manufacturer));
  const canCompare = selectedCandidates.length === 2 && !!phoenixPick && !!otherPick;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="text-secondary">{result.searchNotes}</div>

      {result.candidates.map((c) => {
        const isSelected = selected.includes(c.partNumber);
        return (
          <div
            key={c.partNumber}
            className="card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              borderColor: isSelected ? "var(--accent)" : undefined,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(c.partNumber)}
                style={{ marginTop: 4 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>
                  {c.manufacturer} {c.partNumber}
                  <span className="text-secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                    {MATCH_LABEL[c.matchScore]}
                  </span>
                </div>
                <div className="text-secondary">{c.description}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{c.matchNotes}</div>
                {c.listPrice && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {c.listPrice.currency} {c.listPrice.amount.toFixed(2)}
                    <span className="text-secondary"> ({c.listPrice.source})</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="primary"
          disabled={!canCompare}
          onClick={() => phoenixPick && otherPick && onCompareSelected(phoenixPick.partNumber, otherPick.partNumber)}
        >
          Compare selected in detail
        </button>
        <span className="text-secondary" style={{ fontSize: 13 }}>
          {selectedCandidates.length === 0 && "Select two candidates, one of which is a Phoenix Contact part."}
          {selectedCandidates.length === 1 && "Select one more."}
          {selectedCandidates.length === 2 && !canCompare &&
            "Detailed comparison needs one Phoenix Contact part and one competitor part."}
        </span>
      </div>
    </div>
  );
}
