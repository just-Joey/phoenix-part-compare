import type { ComparisonResult as Result } from "../types";

function PartCard({ label, part }: { label: string; part: Result["phoenix"] | null }) {
  if (!part) {
    return (
      <div className="card" style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div className="text-secondary">No close match found — see alternates below.</div>
      </div>
    );
  }
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div>{part.manufacturer} {part.partNumber}</div>
      <div className="text-secondary">{part.description}</div>
      {part.listPrice && (
        <div style={{ marginTop: 8 }}>
          {part.listPrice.currency} {part.listPrice.amount.toFixed(2)}
          <span className="text-secondary">
            {" "}
            ({part.listPrice.source}, as of {part.listPrice.asOf})
          </span>
        </div>
      )}
      <table style={{ marginTop: 8, fontSize: 13 }}>
        <tbody>
          {Object.entries(part.keySpecs).map(([k, v]) => (
            <tr key={k}>
              <td className="text-secondary" style={{ paddingRight: 12 }}>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  result: Result;
  // Lets the user pick a different candidate and re-run the comparison
  // against that specific part instead of the engine's top pick.
  onCompareInstead?: (partNumber: string) => void;
}

export function ComparisonResultView({ result, onCompareInstead }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <PartCard label="Phoenix Contact" part={result.phoenix} />
        <PartCard label="Competitor" part={result.competitor} />
      </div>

      <div>
        <strong>Price delta: </strong>
        {result.priceDelta.absoluteUsd != null
          ? `$${result.priceDelta.absoluteUsd.toFixed(2)} (${result.priceDelta.percent?.toFixed(0)}%)`
          : "unknown"}
        <div className="text-secondary">{result.priceDelta.note}</div>
      </div>

      {result.similarities.length > 0 && (
        <div>
          <strong>Similarities</strong>
          <ul>
            {result.similarities.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.differences.length > 0 && (
        <div>
          <strong>Differences</strong>
          <table style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>Field</th>
                <th>Phoenix</th>
                <th>Competitor</th>
                <th>Significance</th>
              </tr>
            </thead>
            <tbody>
              {result.differences.map((d, i) => (
                <tr key={i}>
                  <td>{d.field}</td>
                  <td>{d.phoenixValue}</td>
                  <td>{d.competitorValue}</td>
                  <td>{d.significance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.otherCandidates.length > 0 && (
        <div>
          <strong>Other brands worth a look</strong>
          <div className="text-secondary" style={{ marginBottom: 8 }}>
            Considered but not the primary pick above — click one to compare it directly instead.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.otherCandidates.map((c, i) => (
              <div
                key={i}
                className="card"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
              >
                <div>
                  <div>{c.manufacturer} {c.partNumber}</div>
                  <div className="text-secondary">{c.reason}</div>
                </div>
                {onCompareInstead && (
                  <button onClick={() => onCompareInstead(c.partNumber)}>Compare this instead</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.alternates.length > 0 && (
        <div>
          <strong>Alternates</strong>
          <ul>
            {result.alternates.map((a, i) => (
              <li key={i}>
                {a.manufacturer} {a.partNumber} — {a.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-secondary">
        Confidence: {result.confidence}. {result.researchNotes}
      </div>
    </div>
  );
}
