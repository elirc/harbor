import { useState, type CSSProperties } from "react";
import { apiPost } from "./lib/api";

/**
 * The reply composer (S04). The tab you're on decides where the words go: **Reply** emails the customer,
 * **Note** is internal and never leaves the building. ⚠️ We make the note path visually loud (amber) because
 * the worst bug in support is a private note sent to the customer — but the real guarantee is server-side: a
 * note is `emailed:false` by type, not by the color of this box.
 */
export function Composer({ conversationId, onSent }: { conversationId: string; onSent: () => void }): JSX.Element {
  const [kind, setKind] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function send(): Promise<void> {
    if (!body.trim()) return;
    setStatus("sending…");
    try {
      const res = await apiPost<{ emailed: boolean }>(`/conversations/${conversationId}/compose`, { kind, body });
      setStatus(res.emailed ? "sent to customer" : "note saved (not emailed)");
      setBody("");
      onSent();
    } catch (e: unknown) {
      setStatus(`failed: ${String(e)}`);
    }
  }

  /**
   * ✨ Ask the answer-bot for a DRAFT (S12). Assistive by default: the bot proposes a grounded reply (or refuses),
   * and the agent reviews/edits/sends it. If the bot refuses (weak retrieval / out of scope), we say so rather
   * than paste a confident guess — autonomy is earned in S14, never assumed.
   */
  async function draft(): Promise<void> {
    setStatus("drafting…");
    const res = await apiPost<{ answer: string; refused: boolean; grounded: boolean }>("/bot/draft", { conversationId }).catch(() => null);
    if (!res) return setStatus("draft failed");
    if (res.refused) return setStatus("bot refused (no confident grounded answer) — reply manually");
    setKind("reply");
    setBody(res.answer);
    setStatus(res.grounded ? "AI draft inserted (grounded) — review before sending" : "AI draft inserted — review");
  }

  const noteMode = kind === "note";
  return (
    <div style={{ ...wrap, borderColor: noteMode ? "#8a6d1d" : "#232a32", background: noteMode ? "#211d12" : "transparent" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button style={tab(kind === "reply")} onClick={() => setKind("reply")}>Reply</button>
        <button style={tab(kind === "note")} onClick={() => setKind("note")}>Internal note</button>
        <button style={{ ...tab(false), marginLeft: "auto" }} onClick={() => void draft()}>✨ AI draft</button>
        {noteMode && <span style={{ color: "#e3b341", fontSize: 12, alignSelf: "center" }}>👁 Not visible to the customer</span>}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={noteMode ? "Leave a note for your teammates…" : "Write a reply…"}
        style={{ ...textarea, borderColor: noteMode ? "#8a6d1d" : "#232a32" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {/* S14 a11y: status changes (drafting, sent, bot refused) announced politely to screen readers. */}
        <span role="status" aria-live="polite" style={{ color: "#8b93a1", fontSize: 12 }}>{status}</span>
        <button style={sendBtn} onClick={() => void send()}>{noteMode ? "Save note" : "Send reply"}</button>
      </div>
    </div>
  );
}

const wrap: CSSProperties = { border: "1px solid #232a32", borderRadius: 10, padding: 12, marginTop: 8 };
const textarea: CSSProperties = { width: "100%", minHeight: 64, background: "#0d1117", color: "#e6edf3", border: "1px solid #232a32", borderRadius: 8, padding: 8, resize: "vertical", boxSizing: "border-box" };
const sendBtn: CSSProperties = { background: "#1d76db", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer" };
function tab(active: boolean): CSSProperties {
  return { background: active ? "#1d76db" : "transparent", color: active ? "white" : "#8b93a1", border: "1px solid #232a32", borderRadius: 8, padding: "4px 10px", cursor: "pointer" };
}
