import { useState } from "react";

interface Props {
  onSubmit: (competitorManufacturer: string, competitorPartNumber: string, phoenixPartNumber: string) => void;
  loading: boolean;
}

// Free text rather than a locked dropdown — reps will run into brands
// outside this list, and a closed dropdown would just block the search
// instead of letting Claude figure it out from the name.
const COMMON_MANUFACTURERS = [
  "Weidmüller",
  "WAGO",
  "Eaton",
  "Schneider Electric",
  "ABB",
  "Omron",
  "IDEC",
  "TE Connectivity",
  "Finder",
  "Rockwell/Allen-Bradley",
];

export function ReverseSearchForm({ onSubmit, loading }: Props) {
  const [manufacturer, setManufacturer] = useState("");
  const [competitorPartNumber, setCompetitorPartNumber] = useState("");
  const [phoenixPartNumber, setPhoenixPartNumber] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (manufacturer.trim() && competitorPartNumber.trim()) {
          onSubmit(manufacturer.trim(), competitorPartNumber.trim(), phoenixPartNumber.trim());
        }
      }}
      style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        Competitor manufacturer
        <input
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          placeholder="e.g. Weidmüller"
          list="manufacturer-suggestions"
          required
          style={{ minWidth: 180 }}
        />
        <datalist id="manufacturer-suggestions">
          {COMMON_MANUFACTURERS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        Competitor part number
        <input
          value={competitorPartNumber}
          onChange={(e) => setCompetitorPartNumber(e.target.value)}
          placeholder="e.g. 2576130000"
          required
          style={{ minWidth: 220 }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        Phoenix part, if you already know it (optional)
        <input
          value={phoenixPartNumber}
          onChange={(e) => setPhoenixPartNumber(e.target.value)}
          placeholder="leave blank to find it"
          style={{ minWidth: 220 }}
        />
      </label>
      <button type="submit" className="primary" disabled={loading}>
        {loading ? "Researching…" : "Find Phoenix equivalent"}
      </button>
    </form>
  );
}
