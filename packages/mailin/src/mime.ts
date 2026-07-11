/**
 * MIME parsing (S03). 📘 AN EMAIL IS A TREE, NOT A STRING. A real message is a nested structure —
 * multipart/alternative (a text and an HTML version of the same body), multipart/mixed (body + attachments),
 * nested forwards — and the naive `body.split("\n\n")` parser breaks on all of it. We walk the tree
 * recursively, decode each leaf by its transfer-encoding + charset, and pull out the text, HTML, and
 * attachments. ⚠️ Decode DEFENSIVELY and keep the raw — the "mojibake museum" (mislabeled charsets, base64,
 * encoded-word headers) is real, and when a decode guess is wrong you need the original to recover.
 */

export interface ParsedEmail {
  headers: Record<string, string>;
  subject: string;
  from: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  text: string;
  html: string;
  attachments: { filename: string; contentType: string }[];
}

interface Part {
  headers: Record<string, string>;
  body: string;
}

/** Split a raw message (or part) into headers + body at the first blank line; unfold folded headers. */
function splitHeaders(raw: string): Part {
  const norm = raw.replace(/\r\n/g, "\n");
  const idx = norm.indexOf("\n\n");
  const head = idx === -1 ? norm : norm.slice(0, idx);
  const body = idx === -1 ? "" : norm.slice(idx + 2);
  const headers: Record<string, string> = {};
  // Unfold: a header line continues if the next line starts with whitespace.
  const unfolded = head.replace(/\n[ \t]+/g, " ");
  for (const line of unfolded.split("\n")) {
    const m = /^([!-9;-~]+):\s?(.*)$/.exec(line);
    if (m) headers[m[1].toLowerCase()] = m[2];
  }
  return { headers, body };
}

function param(headerValue: string | undefined, name: string): string | null {
  if (!headerValue) return null;
  const m = new RegExp(`${name}="?([^";]+)"?`, "i").exec(headerValue);
  return m ? m[1] : null;
}

/** Decode an RFC 2047 encoded-word header value, e.g. `=?UTF-8?B?SGVsbG8=?=` → "Hello". */
export function decodeEncodedWord(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_all, charset: string, enc, data: string) => {
    try {
      const isUtf8 = /utf-?8/i.test(charset);
      if (enc.toUpperCase() === "B") return fromBase64(data);
      // Q-encoding: like quoted-printable but "_" means space. The result is a byte string; UTF-8-decode it
      // when the charset says so (the mojibake fix — otherwise multi-byte chars come out as Latin-1).
      const bytes = decodeQuotedPrintable(data.replace(/_/g, " "));
      return isUtf8 ? utf8FromBinary(bytes) : bytes;
    } catch {
      return data; // defensive: a broken encoded-word degrades to its raw payload, never throws
    }
  });
}

/** Reinterpret a Latin-1 "byte string" as UTF-8 (each char is one byte). */
function utf8FromBinary(bin: string): string {
  try {
    return decodeURIComponent(
      bin
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch {
    return bin;
  }
}

export function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function fromBase64(s: string): string {
  const clean = s.replace(/\s+/g, "");
  return utf8FromBinary(atob(clean)); // atob is available in Node 20 + browsers
}

function decodeBody(part: Part): string {
  const enc = (part.headers["content-transfer-encoding"] ?? "7bit").toLowerCase();
  const isUtf8 = /utf-?8/i.test(part.headers["content-type"] ?? "");
  if (enc === "base64") return fromBase64(part.body); // base64 path already UTF-8-decodes
  if (enc === "quoted-printable") {
    const bytes = decodeQuotedPrintable(part.body);
    return isUtf8 ? utf8FromBinary(bytes) : bytes;
  }
  return part.body; // 7bit/8bit/binary — as-is
}

/** Recursively walk a MIME part, accumulating text/html/attachments. */
function walk(part: Part, acc: { text: string[]; html: string[]; attachments: ParsedEmail["attachments"] }): void {
  const contentType = (part.headers["content-type"] ?? "text/plain").toLowerCase();
  const disposition = part.headers["content-disposition"] ?? "";

  if (/attachment/i.test(disposition) || param(part.headers["content-disposition"], "filename")) {
    acc.attachments.push({
      filename: param(part.headers["content-disposition"], "filename") ?? param(part.headers["content-type"], "name") ?? "attachment",
      contentType: contentType.split(";")[0]!.trim(),
    });
    return;
  }

  if (contentType.startsWith("multipart/")) {
    const boundary = param(part.headers["content-type"], "boundary");
    if (!boundary) return;
    for (const child of splitMultipart(part.body, boundary)) walk(splitHeaders(child), acc);
    return;
  }

  const decoded = decodeBody(part);
  if (contentType.startsWith("text/html")) acc.html.push(decoded);
  else acc.text.push(decoded);
}

function splitMultipart(body: string, boundary: string): string[] {
  const marker = `--${boundary}`;
  return body
    .split(marker)
    .slice(1) // drop the preamble before the first boundary
    .filter((p) => !p.startsWith("--")) // drop the closing "--boundary--"
    .map((p) => p.replace(/^\r?\n/, "")); // strip the CRLF after the boundary line
}

export function parseEmail(raw: string): ParsedEmail {
  const top = splitHeaders(raw);
  const acc = { text: [] as string[], html: [] as string[], attachments: [] as ParsedEmail["attachments"] };
  walk(top, acc);
  const references = (top.headers["references"] ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    headers: top.headers,
    subject: decodeEncodedWord(top.headers["subject"] ?? ""),
    from: decodeEncodedWord(top.headers["from"] ?? ""),
    messageId: top.headers["message-id"] ?? null,
    inReplyTo: top.headers["in-reply-to"] ?? null,
    references,
    text: acc.text.join("\n").trim(),
    html: acc.html.join("\n").trim(),
    attachments: acc.attachments,
  };
}
