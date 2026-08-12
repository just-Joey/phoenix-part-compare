import { useState } from "react";
import type { SpecSearchFilters } from "../types";

interface Props {
  onSubmit: (description: string, filters: SpecSearchFilters) => void;
  loading: boolean;
}

const EMPTY_FILTERS: SpecSearchFilters = {
  category: "",
  voltage: "",
  contactConfig: "",
  connectionType: "",
  currentRating: "",
  mounting: "",
};

export function SpecSearchForm({ onSubmit, loading }: Props) {
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<SpecSearchFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (description.trim()) onSubmit(description.trim(), filters);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        Describe what you need
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. 4-pole relay module, 24VDC coil, push-in terminals, DIN rail mount, comparable to our current Phoenix Contact setup but rated for higher current"
          required
          rows={3}
          style={{ resize: "vertical" }}
        />
      </label>

      <button
        type="button"
        onClick={() => setShowFilters((s) => !s)}
        style={{ alignSelf: "flex-start", fontSize: 13 }}
      >
        {showFilters ? "Hide filters" : "Narrow with filters (optional)"}
      </button>

      {showFilters && (
        <div
          className="card"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}
        >
          <FilterField
            label="Category"
            value={filters.category ?? ""}
            placeholder="relay module, terminal block…"
            onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          />
          <FilterField
            label="Voltage"
            value={filters.voltage ?? ""}
            placeholder="24VDC"
            onChange={(v) => setFilters((f) => ({ ...f, voltage: v }))}
          />
          <FilterField
            label="Contact config"
            value={filters.contactConfig ?? ""}
            placeholder="4CO, SPDT…"
            onChange={(v) => setFilters((f) => ({ ...f, contactConfig: v }))}
          />
          <FilterField
            label="Connection type"
            value={filters.connectionType ?? ""}
            placeholder="push-in, screw…"
            onChange={(v) => setFilters((f) => ({ ...f, connectionType: v }))}
          />
          <FilterField
            label="Current rating"
            value={filters.currentRating ?? ""}
            placeholder="6A+"
            onChange={(v) => setFilters((f) => ({ ...f, currentRating: v }))}
          />
          <FilterField
            label="Mounting"
            value={filters.mounting ?? ""}
            placeholder="DIN rail"
            onChange={(v) => setFilters((f) => ({ ...f, mounting: v }))}
          />
        </div>
      )}

      <button type="submit" className="primary" disabled={loading} style={{ alignSelf: "flex-start" }}>
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

function FilterField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
