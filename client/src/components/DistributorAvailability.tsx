import type { DistributorAvailability as Availability } from "../types";

const DISPLAY_NAMES: Record<Availability["distributor"], string> = {
  graybar_denver: "Graybar Denver",
  thorp_controls: "Thorp Controls",
  crum_electric: "Crum Electric Supply",
  rs_americas: "RS Americas",
};

const STATUS_LABEL: Record<Availability["status"], string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  unknown: "Unknown — check manually",
  link_only: "Check on site",
  error: "Check failed",
};

export function DistributorAvailabilityList({ items }: { items: Availability[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {items.map((item) => (
        <div key={item.distributor} className="card">
          <div style={{ fontWeight: 600 }}>{DISPLAY_NAMES[item.distributor]}</div>
          <div className="text-secondary">{STATUS_LABEL[item.status]}</div>
          {item.unitPrice != null && <div>${item.unitPrice.toFixed(2)}</div>}
          {item.leadTime && <div>Lead time: {item.leadTime}</div>}
          {item.sourceUrl && (
            <div style={{ marginTop: 4 }}>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Open on distributor site →
              </a>
            </div>
          )}
          {item.errorMessage && (
            <div style={{ color: "var(--error)", fontSize: 12, marginTop: 4 }}>{item.errorMessage}</div>
          )}
        </div>
      ))}
    </div>
  );
}
