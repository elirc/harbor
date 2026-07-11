/**
 * Shared-inbox logic (S04). A shared inbox is a concurrency problem with a friendly face: an explicit state
 * machine, an assignment claim that survives two agents racing, and the never-email-the-internal-note rule.
 * These are pure models so the race and the invariants are testable without a DB.
 */
import type { ConversationState } from "./index";

// ── The conversation state machine ───────────────────────────────────────────────────────────────
/**
 * 📘 The conversation lifecycle as an EXPLICIT machine — one write path, valid transitions only (🔗
 * Meridian's law, restated). An inbound message reopens a closed/snoozed conversation; an agent can pend,
 * snooze, or close. Anything not listed is rejected, so the state can't drift into nonsense.
 */
const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  open: ["pending", "snoozed", "closed"],
  pending: ["open", "snoozed", "closed"],
  snoozed: ["open", "closed"], // a snooze timer or a reply wakes it to open
  closed: ["open"], // reopen only
};

export function canTransition(from: ConversationState, to: ConversationState): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** An inbound customer message always brings a conversation back to `open` (from any state). */
export function stateAfterInbound(_current: ConversationState): ConversationState {
  return "open";
}

// ── Assignment claim (the double-claim arc) ──────────────────────────────────────────────────────
export interface ClaimResult {
  ok: boolean;
  assigneeId: string | null;
}

/** In-memory model of a shared inbox's assignments, to demonstrate the claim race and its fix. */
export class InboxAssignments {
  private readonly assignee = new Map<string, string | null>();

  seed(conversationId: string, assigneeId: string | null = null): void {
    this.assignee.set(conversationId, assigneeId);
  }
  assigneeOf(conversationId: string): string | null {
    return this.assignee.get(conversationId) ?? null;
  }

  /**
   * ⚠️ NAIVE claim — read-then-write with no atomicity. Two agents claiming one UNASSIGNED conversation both
   * read `assignee = null` and both write their own id: both think they won (the second silently overwrites
   * the first). The `beforeWrite` hook exposes the race window. 🔗 The Tracer S6 approval race, support-shaped.
   * [fix-later-in-PR] — a failing test pins this, then the atomic claim replaces it.
   */
  async claimNaive(conversationId: string, agentId: string, beforeWrite = async () => {}): Promise<ClaimResult> {
    const current = this.assignee.get(conversationId) ?? null;
    if (current !== null) return { ok: false, assigneeId: current };
    await beforeWrite(); // <-- race window
    this.assignee.set(conversationId, agentId);
    return { ok: true, assigneeId: agentId };
  }
}

// ── Internal notes never leave the building ──────────────────────────────────────────────────────
export type OutgoingKind = "reply" | "note";

/**
 * ⚠️ THE HIGHEST-STAKES BUG IN SUPPORT: an internal note (meant for colleagues) sent to the customer. We
 * prevent it by TYPE, not by discipline: a `note` is never emailable. The send path checks this; an E2E
 * asserts a note never leaves the building.
 */
export function isEmailable(kind: OutgoingKind): boolean {
  return kind === "reply";
}

// ── Canned replies: safe interpolation, no eval ──────────────────────────────────────────────────
/**
 * 📘 Templating with variable insertion ({{contact.name}}) — 🔗 the Relay S4 lesson: NEVER eval user
 * templates. We do a literal `{{path}}` → value substitution over a plain object; an unknown variable
 * renders as empty, and nothing in the template can execute code.
 */
export function renderCanned(template: string, vars: Record<string, string>): string {
  // ⚠️ Read only OWN properties: a bare `vars[path]` would walk the prototype chain and leak
  // `constructor` / `__proto__` into the rendered reply. "No eval" isn't enough — don't traverse the
  // prototype either. hasOwnProperty via Object.prototype (in case `vars` itself defines a "hasOwnProperty").
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) =>
    Object.prototype.hasOwnProperty.call(vars, path) ? vars[path] : "",
  );
}

// ── Outbound threading headers ───────────────────────────────────────────────────────────────────
/**
 * 🔗 An outbound reply must SET `In-Reply-To` and `References` so the CUSTOMER'S client threads it correctly.
 * (And note: if we set these on the way out, we should *consume* them on the way in — foreshadowing the S03
 * threading robustness we deferred.)
 */
export function buildReplyHeaders(parentMessageId: string, parentReferences: readonly string[]): { inReplyTo: string; references: string[] } {
  return { inReplyTo: parentMessageId, references: [...parentReferences, parentMessageId] };
}
