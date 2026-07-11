/**
 * Threading (S03): attach an inbound email to the right conversation.
 *
 * 🔗 Threading is subtle — we'll revisit its robustness. For now we match on the NORMALIZED SUBJECT: strip
 * the "Re:"/"Fwd:" prefixes and compare. It gets the demo working: a customer replies, "Re: your ticket"
 * matches the open "your ticket" conversation, and the message lands in the right thread.
 */

/** Strip leading Re:/Fwd:/Fw: (any depth) and collapse whitespace, for subject comparison. */
export function normalizeSubject(subject: string): string {
  let s = subject.trim();
  // Remove any run of reply/forward prefixes at the start (case-insensitive, localized-ish).
  for (;;) {
    const stripped = s.replace(/^\s*(re|fwd?|aw|sv|antw)\s*(\[\d+\])?\s*:\s*/i, "");
    if (stripped === s) break;
    s = stripped;
  }
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export interface OpenConversation {
  id: string;
  subject: string;
}

/**
 * Find the open conversation an inbound email threads into, by normalized subject. Returns null to start a
 * new conversation. (Subject matching is the available signal; whether it's the *right* signal is a question
 * this sprint's ADR flags for later.)
 */
export function threadBySubject(subject: string, openConversations: readonly OpenConversation[]): string | null {
  const norm = normalizeSubject(subject);
  if (!norm) return null;
  const match = openConversations.find((c) => normalizeSubject(c.subject) === norm);
  return match ? match.id : null;
}
