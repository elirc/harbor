/**
 * Contact identity resolution (S02). One human reaches support from many places — several emails, a messenger
 * session, an external CRM id — and Harbor must recognize them as ONE contact. This is the same hard table
 * every product has: 🔗 Meridian's workers, Pulse's persons, now Harbor's contacts. The pattern is stable:
 * **resolve at write (attach at ingest), merge deterministically, never rewrite history.**
 *
 * These are pure, in-memory models of the resolve-or-create and merge logic — so the concurrency arc (the
 * merge race) and the merge invariants are testable without a database.
 */

export type IdentityType = "email" | "messenger" | "external";

/**
 * 📘 Which identifiers are strong enough to AUTO-merge on? A *verified* identifier (a confirmed email, an
 * authenticated messenger session) is a strong signal; an unverified external id is weak (it might be a
 * shared or mistyped value). Auto-merge only on verified; suggest-merge for weak signals — a wrong merge is
 * nearly irreversible (ADR debate).
 */
export function isVerifiedIdentifier(type: IdentityType): boolean {
  return type === "email" || type === "messenger";
}

export interface Contact {
  id: string;
  createdAt: number;
}

/**
 * 📘 DETERMINISTIC WINNER: oldest contact wins. This makes re-merging idempotent — merge(a,b) and merge(b,a)
 * pick the same survivor, and merging an already-merged pair is a no-op. 🔗 Same reason as Pulse S6:
 * deterministic conflict resolution is a recurring tool.
 */
export function pickSurvivor(a: Contact, b: Contact): Contact {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? a : b;
  return a.id <= b.id ? a : b; // stable tie-break
}

/** A per-key async mutex — models Postgres `pg_advisory_xact_lock(hash(identifier))`. */
class KeyedMutex {
  private chains = new Map<string, Promise<void>>();
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((res) => (release = res));
    this.chains.set(key, prev.then(() => next));
    await prev; // wait our turn on this key
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/** An in-memory store modeling the DB: contacts, identities (unique per key), conversations per contact. */
export class IdentityResolver {
  private readonly contacts = new Map<string, Contact>();
  private readonly identities = new Map<string, string>(); // "ws|type|value" -> contactId
  private readonly conversations = new Map<string, string>(); // conversationId -> contactId
  private readonly mutex = new KeyedMutex();
  private seq = 0;

  private key(ws: string, type: IdentityType, value: string): string {
    return `${ws}|${type}|${value}`;
  }

  get contactCount(): number {
    return this.contacts.size;
  }

  attachConversation(conversationId: string, contactId: string): void {
    this.conversations.set(conversationId, contactId);
  }
  conversationsOf(contactId: string): string[] {
    return [...this.conversations.entries()].filter(([, c]) => c === contactId).map(([id]) => id);
  }
  identitiesOf(contactId: string): string[] {
    return [...this.identities.entries()].filter(([, c]) => c === contactId).map(([k]) => k);
  }

  /**
   * ⚠️ NAIVE resolve-or-create — check-then-create with NO lock. Two inbound messages from a brand-new user on
   * two channels can both pass the "does this identity exist?" check before either creates, and end up
   * creating TWO contacts for one person. The `beforeCreate` hook exposes that race window for the test.
   */
  async resolveOrCreateNaive(ws: string, type: IdentityType, value: string, beforeCreate = async () => {}): Promise<string> {
    const k = this.key(ws, type, value);
    const existing = this.identities.get(k);
    if (existing) return existing;
    await beforeCreate(); // <-- the race window
    return this.create(k);
  }

  /**
   * The fix: serialize resolve-or-create per identifier with an advisory lock. The second caller waits for
   * the first, then finds the identity the first created — one contact. 🔗 "We solved this exact shape in
   * Pulse S6; here it is again." Note the lock is keyed on the *identifier*, not a global lock — concurrent
   * resolution of DIFFERENT identifiers still runs in parallel.
   */
  async resolveOrCreate(ws: string, type: IdentityType, value: string, beforeCreate = async () => {}): Promise<string> {
    const k = this.key(ws, type, value);
    return this.mutex.run(k, async () => {
      const existing = this.identities.get(k);
      if (existing) return existing;
      await beforeCreate();
      return this.create(k);
    });
  }

  private create(k: string): string {
    const id = `c${++this.seq}`;
    this.contacts.set(id, { id, createdAt: this.seq });
    this.identities.set(k, id);
    return id;
  }

  /**
   * Merge two contacts into the deterministic survivor: reassign the loser's identities AND conversations,
   * then drop the loser. ⚠️ Reattachment must be atomic — an orphaned conversation (pointing at a deleted
   * contact) is a support incident. Idempotent: merging an already-merged pair is a no-op.
   */
  merge(aId: string, bId: string): string {
    if (aId === bId) return aId;
    const a = this.contacts.get(aId);
    const b = this.contacts.get(bId);
    if (!a || !b) return this.contacts.has(aId) ? aId : bId; // already merged one side
    const survivor = pickSurvivor(a, b);
    const loser = survivor.id === aId ? bId : aId;
    for (const [k, c] of this.identities) if (c === loser) this.identities.set(k, survivor.id);
    for (const [conv, c] of this.conversations) if (c === loser) this.conversations.set(conv, survivor.id);
    this.contacts.delete(loser);
    return survivor.id;
  }
}
