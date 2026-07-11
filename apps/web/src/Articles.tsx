import { useEffect, useState, type CSSProperties } from "react";
import { apiGet, apiPost } from "./lib/api";
import { Search } from "./Search";
import { AskDocs } from "./AskDocs";

interface Article {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: string;
}

/**
 * Help-center article authoring (S05). The agent side of the public help center: write an article, save it as
 * a draft, publish when ready. Publishing is what makes it appear on the server-rendered public site — drafts
 * never leak (enforced server-side by the published-only filter, not just hidden here).
 */
export function Articles(): JSX.Element {
  const [articles, setArticles] = useState<Article[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = (): void => {
    apiGet<Article[]>("/articles?workspaceId=demo-ws")
      .then(setArticles)
      .catch(() => setArticles([]));
  };
  useEffect(load, []);

  async function create(status: "draft" | "published"): Promise<void> {
    if (!title.trim()) return;
    try {
      const a = await apiPost<Article>("/articles", { workspaceId: "demo-ws", title, body, status });
      setMsg(`${status === "published" ? "Published" : "Saved draft"} · /help/${a.slug}`);
      setTitle("");
      setBody("");
      load();
    } catch (e: unknown) {
      setMsg(`failed: ${String(e)}`);
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16, color: "#1d76db" }}>Help Center · Articles</h2>
      <Search />
      <AskDocs />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" style={input} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the article… (blank line separates paragraphs)" style={textarea} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button style={ghost} onClick={() => void create("draft")}>Save draft</button>
        <button style={primary} onClick={() => void create("published")}>Publish</button>
        {msg && <span style={{ color: "#8b93a1", fontSize: 12 }}>{msg}</span>}
      </div>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
        {articles.map((a) => (
          <li key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #232a32" }}>
            <span>{a.title}</span>
            <span style={{ fontSize: 12, color: a.status === "published" ? "#3fb950" : "#8b93a1" }}>{a.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const input: CSSProperties = { width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #232a32", borderRadius: 8, padding: 8, marginBottom: 8, boxSizing: "border-box" };
const textarea: CSSProperties = { ...input, minHeight: 96, resize: "vertical" };
const primary: CSSProperties = { background: "#1d76db", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer" };
const ghost: CSSProperties = { background: "transparent", color: "#8b93a1", border: "1px solid #232a32", borderRadius: 8, padding: "6px 14px", cursor: "pointer" };
