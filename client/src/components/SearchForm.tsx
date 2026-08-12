import { useState } from "react";

interface Props {
  onSubmit: (phoenixPartNumber: string, competitorPartNumber: string) => void;
  loading: boolean;
}

export function SearchForm({ onSubmit, loading }: Props) {
  const [phoenixPartNumber, setPhoenixPartNumber] = useState("");
  const [competitorPartNumber, setCompetitorPartNumber] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (phoenixPartNumber.trim()) {
          onSubmit(phoenixPartNumber.trim(), competitorPartNumber.trim());
        }
      }}
      style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        Phoenix Contact part number
        <input
          value={phoenixPartNumber}
          onChange={(e) => setPhoenixPartNumber(e.target.value)}
          placeholder="e.g. 2903308"
          required
          style={{ minWidth: 220 }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        Competitor part number (optional)
        <input
          value={competitorPartNumber}
          onChange={(e) => setCompetitorPartNumber(e.target.value)}
          placeholder="leave blank to auto-find"
          style={{ minWidth: 220 }}
        />
      </label>
      <button type="submit" className="primary" disabled={loading}>
        {loading ? "Researching…" : "Compare"}
      </button>
    </form>
  );
}
