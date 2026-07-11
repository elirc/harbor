import { useState, type CSSProperties } from "react";
import { apiPost } from "./lib/api";

interface Triage {
  intent: string;
  urgency: string;
  sentiment: string;
  suggestedTeam: string;
  confidence: number;
  reasoning: string;
}
interface TriageResult {
  id: string;
  triage: Triage;
  fellBack: boolean;
}

const INTENTS = ["billing", "technical", "sales", "account", "feedback", "other"];

/**
 * AI triage panel (S11). Run triage on a conversation, see the classification AND the model's reasoning (never
 * a black box), and CORRECT it. 📘 A correction is a suggestion overridden — and free labeled data: it becomes
 * a new eval case (the data flywheel). The model proposes; the agent disposes.
 */
export function TriagePanel({ conversationId }: { conversationId: string }): JSX.Element {
  const [res, setRes] = useState<TriageResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(): Promise<void> {
    setBusy(true);
    try {
      setRes(await apiPost<TriageResult>(`/conversations/${conversationId}/triage`, {}));
    } catch {
      setRes(null);
    } finally {
      setBusy(false);
    }
  }
  async function correct(intent: string): Promise<void> {
    if (!res) return;
    await apiPost(`/ai-actions/${res.id}/correct`, { intent }).catch(() => undefined);
    setRes({ ...res, triage: { ...res.triage, intent } });
  }

  return (
    <div style={{ ...wrap }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 13, color: "#1d76db" }}>AI triage (suggestion)</strong>
        <button style={ghost} onClick={() => void run()} disabled={busy}>{busy ? "…" : "Run triage"}</button>
      </div>
      {res && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <div>
            <b>{res.triage.intent}</b> · {res.triage.urgency} · {res.triage.sentiment} · → {res.triage.suggestedTeam}{" "}
            <span style={{ color: "#8b93a1" }}>({Math.round(res.triage.confidence * 100)}% conf{res.fellBack ? ", fell back" : ""})</span>
          </div>
          <div style={{ color: "#8b93a1", fontSize: 12, marginTop: 2 }}>{res.triage.reasoning}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#5b6572" }}>Correct →</span>
            {INTENTS.map((i) => (
              <button key={i} style={chip(res.triage.intent === i)} onClick={() => void correct(i)}>{i}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const wrap: CSSProperties = { border: "1px solid #232a32", borderRadius: 10, padding: 12, marginTop: 8 };
const ghost: CSSProperties = { background: "transparent", color: "#8b93a1", border: "1px solid #232a32", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 12 };
function chip(active: boolean): CSSProperties {
  return { background: active ? "#1d76db" : "transparent", color: active ? "white" : "#8b93a1", border: "1px solid #232a32", borderRadius: 999, padding: "2px 8px", cursor: "pointer", fontSize: 11 };
}
