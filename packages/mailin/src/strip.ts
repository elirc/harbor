/**
 * Reply & signature stripping (S03). 📘 THERE IS NO STANDARD FOR QUOTED TEXT — every email client marks it
 * differently (`>` prefixes, "On … wrote:" intros, "-----Original Message-----", Outlook's blank-line-then-
 * From:). So stripping is heuristics, and heuristics are wrong sometimes. The honest design: strip for
 * DISPLAY, keep the RAW, and give the user a "show original" escape hatch — perfection is impossible, so make
 * imperfection recoverable. 🔍 Never mutate the original; stripping is a *view*.
 */

/** Markers that begin the quoted history of a reply. Everything from the first match down is quoted. */
const QUOTE_MARKERS: RegExp[] = [
  /^On .+ wrote:$/m, // Gmail, Apple Mail
  /^-{2,}\s*Original Message\s*-{2,}/im, // Outlook
  /^-{2,}\s*Forwarded message\s*-{2,}/im, // Gmail forward
  /^From:\s.+\nSent:\s/im, // Outlook header block
  /^_{5,}$/m, // Outlook divider line
  /^Le .+ a écrit :$/m, // localized (fr)
];

/** Remove quoted reply history: cut at the earliest quote marker, and drop `>`-prefixed blocks. */
export function stripQuotedReply(text: string): string {
  let cut = text.length;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  let head = text.slice(0, cut);
  // Also drop trailing `>`-quoted lines the markers didn't catch.
  const lines = head.split("\n");
  while (lines.length && /^\s*>/.test(lines[lines.length - 1]!)) lines.pop();
  head = lines.join("\n");
  return head.trim();
}

/**
 * Remove a signature block. Best-effort, and DOCUMENTED as best-effort: the RFC 3676 `-- ` delimiter is
 * reliable; the heuristic (a short trailing block that looks like contact info) is a guess. We keep the raw,
 * so a wrong strip is recoverable via "show original".
 */
export function stripSignature(text: string): string {
  // The standard delimiter: a line that is exactly "-- " (dash dash space).
  const delim = text.search(/^-- $/m);
  if (delim !== -1) return text.slice(0, delim).trim();

  // Heuristic: a short trailing block (<=6 lines) after a blank line that looks like a signature.
  const lines = text.split("\n");
  for (let i = Math.max(0, lines.length - 7); i < lines.length; i++) {
    if (lines[i]!.trim() === "" && looksLikeSignature(lines.slice(i + 1))) {
      return lines.slice(0, i).join("\n").trim();
    }
  }
  return text.trim();
}

function looksLikeSignature(block: string[]): boolean {
  if (block.length === 0 || block.length > 6) return false;
  const joined = block.join("\n");
  // Contact-ish signals: a phone number, a title line, "Sent from my", a company/role.
  return /Sent from my|\b(Regards|Best|Thanks|Cheers|Sincerely)\b|\+?\d[\d\s().-]{7,}|\b(CEO|CTO|Manager|Engineer|Support)\b/i.test(joined);
}

/** Convenience: strip a reply's quoted history then its signature (for display). Store raw separately. */
export function stripForDisplay(text: string): string {
  return stripSignature(stripQuotedReply(text));
}
