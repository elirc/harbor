import { useState, type CSSProperties } from "react";
import { apiPost } from "./lib/api";

interface RagAnswer {
  answer: string;
  chunks: Array<{ id: string; heading: string; text: string }>;
  grounded: boolean;
}

/**
 * "Ask the docs" (S10) — the thin generation on top of RAG. Type a question; the API embeds it, retrieves the
 * top help-center chunks (hybrid vector + FTS), and drafts a grounded answer. ⚠️ Deliberately raw: there are no
 * guardrails, no citations, and no "I don't know" yet — the answer-bot's safety (grounding, refusal, cost) is
 * S12's job. Right now it will confidently answer even when retrieval found nothing relevant.
 */
export function AskDocs(): JSX.Element {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<RagAnswer | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(): Promise<void> {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setRes(await apiPost<RagAnswer>("/rag/answer", { workspaceId: "demo-ws", question: q }));
    } catch {
      setRes(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid #232a32", paddingTop: 12 }}>
      <strong style={{ fontSize: 13, color: "#1d76db" }}>Ask the docs (RAG)</strong>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void ask()} placeholder="Ask a question…" style={input} />
        <button style={primary} onClick={() => void ask()} disabled={busy}>{busy ? "…" : "Ask"}</button>
      </div>
      {res && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <p style={{ whiteSpace: "pre-wrap" }}>{res.answer || "(no answer)"}</p>
          <div style={{ color: "#8b93a1", fontSize: 12 }}>
            {res.grounded ? `Grounded in ${res.chunks.length} chunk(s): ${res.chunks.map((c) => c.heading).join(", ")}` : "No relevant chunks retrieved."}
          </div>
        </div>
      )}
    </div>
  );
}

const input: CSSProperties = { flex: 1, background: "#0d1117", color: "#e6edf3", border: "1px solid #232a32", borderRadius: 8, padding: "8px 10px" };
const primary: CSSProperties = { background: "#1d76db", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" };
