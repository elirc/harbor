import { useState, type CSSProperties } from "react";
import { apiGet } from "./lib/api";

interface Hit {
  slug: string;
  title: string;
  snippet: string;
  rank: number;
}

/**
 * Help-center search (S08). Weighted full-text search with highlighted snippets, served by Postgres FTS. The
 * same endpoint powers the agent's in-composer article lookup. Every query is logged server-side — a
 * zero-result search is a content-gap signal, not a dead end.
 */
export function Search(): JSX.Element {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searched, setSearched] = useState("");

  async function run(): Promise<void> {
    if (!q.trim()) return;
    const res = await apiGet<{ hits: Hit[] }>(`/search?workspaceId=demo-ws&q=${encodeURIComponent(q)}`).catch(() => ({ hits: [] }));
    setHits(res.hits);
    setSearched(q);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void run()}
          placeholder="Search the help center…"
          style={input}
        />
        <button style={primary} onClick={() => void run()}>Search</button>
      </div>
      {hits && (
        <div style={{ marginTop: 10 }}>
          {hits.length === 0 ? (
            <p style={{ color: "#e3b341", fontSize: 13 }}>No results for “{searched}”. (Logged as a content gap.)</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {hits.map((h) => (
                <li key={h.slug} style={{ padding: "8px 0", borderBottom: "1px solid #232a32" }}>
                  <div style={{ color: "#1d76db" }}>{h.title}</div>
                  {/* snippet contains Postgres ts_headline <b> highlights */}
                  <div style={{ color: "#8b93a1", fontSize: 13 }} dangerouslySetInnerHTML={{ __html: h.snippet }} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const input: CSSProperties = { flex: 1, background: "#0d1117", color: "#e6edf3", border: "1px solid #232a32", borderRadius: 8, padding: "8px 10px" };
const primary: CSSProperties = { background: "#1d76db", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" };
