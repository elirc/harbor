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
 *
 * @deprecated S07 — subject-only threading merges unrelated conversations that share a subject (two different
 * customers both emailing "Invoice"). Superseded by `threadEmail`, which threads on the Message-ID chain and
 * falls back to subject ONLY within the same contact. Kept to document the flaw it replaced.
 */
export function threadBySubject(subject: string, openConversations: readonly OpenConversation[]): string | null {
  const norm = normalizeSubject(subject);
  if (!norm) return null;
  const match = openConversations.find((c) => normalizeSubject(c.subject) === norm);
  return match ? match.id : null;
}

// ── S07: header-based threading (harvest of flaw #1, part 1) ───────────────────────────────────────
/**
 * Ledger flaw #1 (planted S03): threading keyed on Subject similarity ONLY. Two unrelated customers who both
 * write "Re: Invoice" get merged into one conversation — a cross-contact data leak. We parsed the right
 * headers all along (`References`/`In-Reply-To`) but didn't thread on them. This harvests part 1.
 */
export interface KnownMessage {
  /** A Message-ID we've previously stored (angle-bracketed, e.g. "<abc@harbor>"). */
  messageId: string;
  conversationId: string;
  /** S13: which contact owns the conversation this message-id belongs to — for the cross-contact guard. */
  contactId?: string;
}

export interface ScopedConversation {
  id: string;
  subject: string;
  /** The conversation's owning contact — subject fallback is scoped to this. */
  contactId: string;
}

export interface ThreadInput {
  inReplyTo: string | null;
  references: readonly string[];
  subject: string;
  /** The resolved sender contact (from S02 identity). Null ⇒ unknown sender ⇒ no subject fallback. */
  fromContactId: string | null;
}

export interface ThreadResult {
  conversationId: string | null;
  via: "headers" | "subject" | "none";
}

/**
 * Thread an inbound email. CORRECT signal first: if any of In-Reply-To / References matches a Message-ID we've
 * stored, thread into that conversation — this works across subject changes, forwards, and localized "Re:"
 * variants, because it follows the actual reply chain. Only if no header matches do we fall back to subject —
 * and that fallback is SCOPED TO THE SENDER'S CONTACT, so two different people's "Invoice" threads never merge.
 *
 * 📘 Migrating a heuristic to a robust signal without breaking existing threads: keep the old signal as a
 * *fallback*, not the primary, and constrain it so its known failure mode (cross-contact merge) can't happen.
 * (Forwarded-chain edge cases — a reply that drops References, a client that rewrites Message-IDs — are S13.)
 */
export function threadEmail(
  input: ThreadInput,
  knownMessages: readonly KnownMessage[],
  openConversations: readonly ScopedConversation[],
): ThreadResult {
  // 1. Follow the reply chain. Most recent parent first (In-Reply-To), then the References ancestry.
  //
  // 🔒 S13 CROSS-CONTACT GUARD (harvest of flaw #1, part 2). A Message-ID match usually means "this is a reply
  // in that thread." But headers travel: when Contact B FORWARDS Contact A's email, B's message carries A's
  // References — and threading it into A's conversation would splice one customer's reply into another's thread
  // (cross-contact contamination, the exact leak the subject-only threader caused, now via headers). So a
  // header match is honored only if the matched conversation belongs to the SAME contact as the sender. A known
  // sender matching another contact's thread ⇒ it's a forward/on-behalf ⇒ don't thread there.
  const chain = [input.inReplyTo, ...input.references].filter((id): id is string => Boolean(id));
  for (const id of chain) {
    const hit = knownMessages.find((m) => m.messageId === id);
    if (!hit) continue;
    const sameContact = hit.contactId === undefined || input.fromContactId === null || hit.contactId === input.fromContactId;
    if (sameContact) return { conversationId: hit.conversationId, via: "headers" };
    // else: header points into another contact's thread (a forward) — fall through, don't contaminate it.
    break;
  }

  // 2. Subject fallback — ONLY within the sender's own open conversations (the misthread fix).
  const norm = normalizeSubject(input.subject);
  if (norm && input.fromContactId) {
    const match = openConversations.find(
      (c) => c.contactId === input.fromContactId && normalizeSubject(c.subject) === norm,
    );
    if (match) return { conversationId: match.id, via: "subject" };
  }

  return { conversationId: null, via: "none" };
}
