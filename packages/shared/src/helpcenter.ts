/**
 * Help-center pure logic (S05). Slugs, the published-only filter, and server-side HTML rendering — kept pure so
 * the SEO surface (the one place Harbor server-renders) is unit-testable without a browser or a DB.
 */

/** URL-safe slug from a title. Deterministic; the same title always yields the same slug. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (combining marks)
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens
    .slice(0, 80) || "untitled";
}

export interface ArticleView {
  slug: string;
  title: string;
  body: string;
  status: string;
  categoryName?: string | null;
}

/** The public site shows PUBLISHED articles only — drafts never leak to search engines or customers. */
export function publishedOnly<T extends { status: string }>(articles: readonly T[]): T[] {
  return articles.filter((a) => a.status === "published");
}

/**
 * 🔍 Escape before you interpolate. Article bodies are authored content; rendering them into HTML without
 * escaping is stored XSS on a PUBLIC page. We escape the five significant characters. (A richer build renders
 * sanitized Markdown; the invariant is the same — never drop untrusted text into HTML raw.)
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Server-render one article to a minimal, SEO-friendly HTML document. */
export function renderArticleHtml(a: ArticleView): string {
  const title = escapeHtml(a.title);
  const paragraphs = a.body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return [
    "<!doctype html>",
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title} · Help Center</title>`,
    `<meta name="description" content="${escapeHtml(a.body.slice(0, 155))}">`,
    `<link rel="canonical" href="/help/${encodeURIComponent(a.slug)}">`,
    "</head><body>",
    "<main>",
    a.categoryName ? `<nav aria-label="Category">${escapeHtml(a.categoryName)}</nav>` : "",
    `<article><h1>${title}</h1>${paragraphs}</article>`,
    "</main>",
    "</body></html>",
  ].join("\n");
}
