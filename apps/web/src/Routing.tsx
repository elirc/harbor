import { useEffect, useState, type CSSProperties } from "react";
import { apiGet, apiPost } from "./lib/api";

interface Rule {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  condition: unknown;
  actions: unknown;
}
interface Decision {
  matchedRuleId: string | null;
  trace: Array<{ ruleId: string; order: number; matched: boolean }>;
}

/**
 * Routing rule builder (S06). 🔗 Relay S8's lesson: a STRUCTURED UI compiles to the safe AST — the admin never
 * writes a query string, they pick fields and values, and we assemble the closed-predicate condition. The
 * preview panel runs the real evaluator server-side and shows which rule fires and why (the debuggability the
 * whole engine is built around).
 */
export function Routing(): JSX.Element {
  const [rules, setRules] = useState<Rule[]>([]);
  const [field, setField] = useState<"channelIs" | "subjectContains" | "attrEquals">("subjectContains");
  const [value, setValue] = useState("billing");
  const [teamId, setTeamId] = useState("team-billing");
  const [order, setOrder] = useState(50);
  const [preview, setPreview] = useState<Decision | null>(null);
  const [previewSubject, setPreviewSubject] = useState("Question about billing");

  const load = (): void => void apiGet<Rule[]>("/routing/rules?workspaceId=demo-ws").then(setRules).catch(() => setRules([]));
  useEffect(load, []);

  function buildCondition(): unknown {
    if (field === "channelIs") return { kind: "channelIs", value };
    if (field === "attrEquals") return { kind: "attrEquals", key: "vip", value };
    return { kind: "subjectContains", value };
  }

  async function addRule(): Promise<void> {
    await apiPost("/routing/rules", {
      workspaceId: "demo-ws",
      name: `${field}:${value} → ${teamId}`,
      order,
      enabled: true,
      condition: buildCondition(),
      actions: [{ type: "assignTeam", teamId }],
    }).catch(() => undefined);
    load();
  }

  async function runPreview(): Promise<void> {
    const d = await apiPost<Decision>("/routing/preview", {
      workspaceId: "demo-ws",
      context: { channel: "email", subject: previewSubject, bodyText: "", contactAttrs: {} },
    }).catch(() => null);
    setPreview(d);
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16, color: "#1d76db" }}>Routing rules</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select value={field} onChange={(e) => setField(e.target.value as typeof field)} style={ctrl}>
          <option value="subjectContains">Subject contains</option>
          <option value="channelIs">Channel is</option>
          <option value="attrEquals">VIP attr equals</option>
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" style={ctrl} />
        <span style={{ color: "#8b93a1" }}>→ assign</span>
        <input value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="team id" style={ctrl} />
        <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} style={{ ...ctrl, width: 72 }} title="order (lower fires first)" />
        <button style={primary} onClick={() => void addRule()}>Add rule</button>
      </div>

      <ol style={{ paddingLeft: 18 }}>
        {rules.map((r) => (
          <li key={r.id} style={{ padding: "4px 0" }}>
            <span style={{ color: "#8b93a1", fontSize: 12 }}>#{r.order}</span> {r.name}{" "}
            <span style={{ fontSize: 11, color: r.enabled ? "#3fb950" : "#8b93a1" }}>{r.enabled ? "enabled" : "off"}</span>
          </li>
        ))}
      </ol>

      <div style={{ marginTop: 12, borderTop: "1px solid #232a32", paddingTop: 12 }}>
        <strong style={{ fontSize: 13 }}>Preview — which rule fires?</strong>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input value={previewSubject} onChange={(e) => setPreviewSubject(e.target.value)} style={{ ...ctrl, flex: 1 }} placeholder="a sample subject" />
          <button style={ghost} onClick={() => void runPreview()}>Preview</button>
        </div>
        {preview && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <div>Winner: <strong>{preview.matchedRuleId ?? "— no rule matched —"}</strong></div>
            <ul style={{ listStyle: "none", padding: 0, color: "#8b93a1" }}>
              {preview.trace.map((t) => (
                <li key={t.ruleId}>{t.matched ? "✅" : "▫️"} #{t.order} {t.ruleId}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

const ctrl: CSSProperties = { background: "#0d1117", color: "#e6edf3", border: "1px solid #232a32", borderRadius: 8, padding: "6px 8px" };
const primary: CSSProperties = { background: "#1d76db", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer" };
const ghost: CSSProperties = { background: "transparent", color: "#8b93a1", border: "1px solid #232a32", borderRadius: 8, padding: "6px 14px", cursor: "pointer" };
