/**
 * Document normalization (S08). Before you can chunk or embed, you have to clean — collapse whitespace, strip
 * markdown scaffolding, and split a document into its heading→body sections. Pure and boring on purpose: this
 * is the preprocessing layer RAG silently lives or dies on.
 */
export interface DocSection {
  heading: string;
  body: string;
}
export interface ParsedDoc {
  title: string;
  sections: DocSection[];
}

/** Collapse runs of whitespace, normalize newlines, trim. Keeps paragraph breaks (double-newline) intact. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split a lightly-marked-up article (markdown-ish `#`/`##` headings) into sections. The first `#` is the
 * title; each `##` starts a section. Text before the first heading becomes an "Overview" section so nothing is
 * lost. This is what makes structure-aware chunking (and later, per-chunk citations) possible.
 */
export function parseSections(markdown: string): ParsedDoc {
  const text = normalizeText(markdown);
  const lines = text.split("\n");
  let title = "";
  const sections: DocSection[] = [];
  let current: DocSection | null = null;

  const flush = (): void => {
    if (current) {
      current.body = current.body.trim();
      sections.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    const h1 = /^#\s+(.*)$/.exec(line);
    const h2 = /^#{2,}\s+(.*)$/.exec(line);
    if (h1 && !title) {
      title = h1[1].trim();
      continue;
    }
    if (h2) {
      flush();
      current = { heading: h2[1].trim(), body: "" };
      continue;
    }
    if (!current) current = { heading: "Overview", body: "" }; // text before the first ## heading
    current.body += (current.body ? "\n" : "") + line;
  }
  flush();
  return { title, sections: sections.filter((s) => s.body.length > 0) };
}
