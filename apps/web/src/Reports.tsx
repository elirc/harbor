import { useEffect, useState, type CSSProperties } from "react";
import { apiGet } from "./lib/api";

interface Overview {
  volume: number;
  firstResponseMinutes: { count: number; p50: number; p90: number; p95: number };
  workload: Record<string, number>;
}

/**
 * Reporting v1 dashboard (S07). Volume, first-response **percentiles** (p50/p90/p95 — never a single average,
 * which hides the angry tail), and per-agent workload. The stats are computed server-side by the shared,
 * tested percentile helpers; this just renders them.
 */
export function Reports(): JSX.Element {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Overview>("/reports/overview?workspaceId=demo-ws")
      .then(setData)
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  if (err) return <p style={{ color: "salmon" }}>Couldn’t load reports ({err}).</p>;
  if (!data) return <p style={{ color: "#8b93a1" }}>Loading…</p>;

  const fr = data.firstResponseMinutes;
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16, color: "#1d76db" }}>Reporting v1</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Stat label="Conversations" value={String(data.volume)} />
        <Stat label="First response · p50" value={fmt(fr.p50)} />
        <Stat label="p90" value={fmt(fr.p90)} hint="the tail the average hides" />
        <Stat label="p95" value={fmt(fr.p95)} hint="about to churn" />
      </div>
      <h3 style={{ fontSize: 14, marginTop: 16, color: "#8b93a1" }}>Open workload by agent</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {Object.entries(data.workload).length === 0 && <li style={{ color: "#8b93a1" }}>No assigned open conversations.</li>}
        {Object.entries(data.workload).map(([agent, n]) => (
          <li key={agent} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #232a32" }}>
            <span>{agent}</span>
            <span style={{ color: "#1d76db" }}>{n} open</span>
          </li>
        ))}
      </ul>
      <p style={{ color: "#5b6572", fontSize: 12, marginTop: 12 }}>
        Response times are percentiles, not averages — p95 is the customer most likely to churn. SLA clocks pause
        off-hours and while awaiting the customer.
      </p>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#8b93a1" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "#5b6572" }}>{hint}</div>}
    </div>
  );
}
function fmt(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}
const card: CSSProperties = { border: "1px solid #232a32", borderRadius: 10, padding: "12px 16px", minWidth: 130 };
