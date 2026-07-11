import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiGet, apiPost, subscribeInbox } from "./lib/api";
import { Composer } from "./Composer";

interface InboxItem {
  conversationId: string;
  subject: string;
  state: string;
  assigneeId?: string | null;
  lastMessagePreview: string;
  updatedAt: string;
}

// In a fuller build this is the signed-in agent; hard-coded here so the two-agent race is easy to demo by
// opening the app in two tabs and changing ME.
const ME = "agent-dana";
const WORKSPACE = "demo-ws";

/**
 * The agent inbox (S04). Now real-time: an SSE stream reflects assignments and new messages without a reload.
 * You can **Claim** an unassigned conversation (atomic — two agents racing, exactly one wins), see soft
 * presence, and reply/note via the composer. 🔗 The "events are hints, refetch for truth" rule from Tracer.
 */
export function App(): JSX.Element {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<InboxItem[]>("/inbox")
      .then(setItems)
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeInbox(WORKSPACE, () => refresh()); // any event → refetch the list
    return unsub;
  }, [refresh]);

  const claim = useCallback(
    async (id: string) => {
      try {
        await apiPost<{ assigneeId: string }>(`/conversations/${id}/claim`, { agentId: ME });
        setFlash(null);
      } catch (e: unknown) {
        // The loser of the race lands here with ALREADY_CLAIMED — a clean, expected outcome, not a crash.
        setFlash(String(e) === "Error: ALREADY_CLAIMED" ? "Someone else claimed it first." : String(e));
      }
      refresh();
    },
    [refresh],
  );

  const selectedItem = useMemo(() => items.find((i) => i.conversationId === selected) ?? null, [items, selected]);

  return (
    <main style={{ maxWidth: 820, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ color: "#1d76db" }}>Harbor · Inbox <span style={{ fontSize: 13, color: "#5b6572" }}>({ME})</span></h1>
      {err && <p style={{ color: "salmon" }}>Couldn’t reach the API ({err}). Is it running on :3001?</p>}
      {flash && <p style={{ color: "#e3b341" }}>{flash}</p>}
      {items.length === 0 && !err && <p style={{ color: "#8b93a1" }}>No conversations yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((c) => {
          const mine = c.assigneeId === ME;
          const takenByOther = c.assigneeId && !mine;
          return (
            <li key={c.conversationId} style={{ ...row, borderColor: selected === c.conversationId ? "#1d76db" : "#232a32" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ cursor: "pointer" }} onClick={() => setSelected(c.conversationId)}>{c.subject}</strong>
                <span style={badge}>{c.state}</span>
              </div>
              <div style={{ color: "#8b93a1", fontSize: 13, marginTop: 4 }}>{c.lastMessagePreview}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: takenByOther ? "#e3b341" : "#5b6572" }}>
                  {mine ? "🟢 Assigned to you" : takenByOther ? `👤 ${c.assigneeId} is on this` : "Unassigned"}
                </span>
                {!c.assigneeId && <button style={claimBtn} onClick={() => void claim(c.conversationId)}>Claim</button>}
              </div>
            </li>
          );
        })}
      </ul>
      {selectedItem && (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>{selectedItem.subject}</h2>
          <Composer conversationId={selectedItem.conversationId} onSent={refresh} />
        </section>
      )}
      <p style={{ color: "#5b6572", fontSize: 12, marginTop: 24 }}>
        Shared inbox — live over SSE, atomic claims, soft presence. Reply emails the customer; an internal note
        never leaves the building.
      </p>
    </main>
  );
}

const row: CSSProperties = { border: "1px solid #232a32", borderRadius: 10, padding: 14, marginBottom: 8 };
const badge: CSSProperties = { fontSize: 11, color: "#1d76db", border: "1px solid #232a32", borderRadius: 999, padding: "2px 8px" };
const claimBtn: CSSProperties = { background: "#1d76db", color: "white", border: "none", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 12 };
