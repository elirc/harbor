import { useEffect, useState, type CSSProperties } from "react";
import { apiGet } from "./lib/api";

interface InboxItem {
  conversationId: string;
  subject: string;
  state: string;
  lastMessagePreview: string;
  updatedAt: string;
}

/**
 * The agent inbox shell (S01). A list of conversations — the walking skeleton's UI. Real-time updates,
 * assignment, and the thread composer arrive in S04. This is a Vite SPA: the authed agent app doesn't need
 * SSR (the public help center, S05, is Harbor's one SSR surface).
 */
export function App() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<InboxItem[]>("/inbox")
      .then(setItems)
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ color: "#1d76db" }}>Harbor · Inbox</h1>
      {err && <p style={{ color: "salmon" }}>Couldn’t reach the API ({err}). Is it running on :3001?</p>}
      {items.length === 0 && !err && <p style={{ color: "#8b93a1" }}>No conversations yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((c) => (
          <li key={c.conversationId} style={row}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{c.subject}</strong>
              <span style={badge}>{c.state}</span>
            </div>
            <div style={{ color: "#8b93a1", fontSize: 13, marginTop: 4 }}>{c.lastMessagePreview}</div>
          </li>
        ))}
      </ul>
      <p style={{ color: "#5b6572", fontSize: 12, marginTop: 24 }}>
        Walking skeleton. Inbound email (S3), the shared inbox (S4), the messenger widget (S5), and the AI
        answer-bot (S9–S12) follow. An LLM feature without an eval is a demo, not a product.
      </p>
    </main>
  );
}

const row: CSSProperties = { border: "1px solid #232a32", borderRadius: 10, padding: 14, marginBottom: 8 };
const badge: CSSProperties = { fontSize: 11, color: "#1d76db", border: "1px solid #232a32", borderRadius: 999, padding: "2px 8px" };
