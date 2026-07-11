/**
 * Routing engine (S06). Automate who-answers-what: rules (condition → action), fair distribution, and business
 * hours. All pure, so rule semantics, round-robin fairness, and the load-aware race are testable without a DB.
 *
 * 🔗 FOURTH appearance of the closed-predicate AST (Tracer S10 filters, Pulse segments, Relay S8 rules, now
 * routing). By now the shape should be a reflex — a discriminated union you *evaluate*, never a string you
 * *eval*, over an allowlisted set of fields. Recognizing that the same shape solves a new problem is the
 * senior skill this repetition is training.
 */
import { z } from "zod";

// ── The condition AST ──────────────────────────────────────────────────────────────────────────
/** The fields a rule may read. An ALLOWLIST: a rule can't reach arbitrary conversation/contact internals. */
export const CONTACT_ATTR_KEYS = ["plan", "company", "locale", "vip"] as const;
export type ContactAttrKey = (typeof CONTACT_ATTR_KEYS)[number];

export interface RoutingContext {
  channel: "email" | "messenger" | "api";
  subject: string;
  bodyText: string;
  contactAttrs: Partial<Record<ContactAttrKey, string>>;
}

export type Condition =
  | { kind: "channelIs"; value: RoutingContext["channel"] }
  | { kind: "subjectContains"; value: string }
  | { kind: "bodyContains"; value: string }
  | { kind: "attrEquals"; key: ContactAttrKey; value: string }
  | { kind: "all"; of: Condition[] }
  | { kind: "any"; of: Condition[] }
  | { kind: "not"; of: Condition };

export type Action =
  | { type: "assignTeam"; teamId: string }
  | { type: "assignAgent"; agentId: string }
  | { type: "setPriority"; priority: "low" | "normal" | "high" | "urgent" };

export interface RoutingRule {
  id: string;
  order: number; // lower fires first
  enabled: boolean;
  condition: Condition;
  actions: Action[];
}

// ── Zod validation for the AST (write path) ──────────────────────────────────────────────────────
/**
 * 🔍 Validate the AST at the trust boundary. A rule arrives as JSON from an admin UI; we parse it into the
 * closed union BEFORE storing, so a malformed or hostile shape (an unknown `kind`, a non-allowlisted attr key)
 * is rejected at write time — the evaluator downstream only ever sees well-formed conditions.
 */
export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("channelIs"), value: z.enum(["email", "messenger", "api"]) }),
    z.object({ kind: z.literal("subjectContains"), value: z.string().min(1) }),
    z.object({ kind: z.literal("bodyContains"), value: z.string().min(1) }),
    z.object({ kind: z.literal("attrEquals"), key: z.enum(CONTACT_ATTR_KEYS), value: z.string() }),
    z.object({ kind: z.literal("all"), of: z.array(ConditionSchema) }),
    z.object({ kind: z.literal("any"), of: z.array(ConditionSchema) }),
    z.object({ kind: z.literal("not"), of: ConditionSchema }),
  ]),
);

export const ActionSchema: z.ZodType<Action> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assignTeam"), teamId: z.string().min(1) }),
  z.object({ type: z.literal("assignAgent"), agentId: z.string().min(1) }),
  z.object({ type: z.literal("setPriority"), priority: z.enum(["low", "normal", "high", "urgent"]) }),
]);

export const RoutingRuleInputSchema = z.object({
  name: z.string().default(""),
  order: z.number().int().default(100),
  enabled: z.boolean().default(true),
  condition: ConditionSchema,
  actions: z.array(ActionSchema).min(1),
});
export type RoutingRuleInput = z.infer<typeof RoutingRuleInputSchema>;

/** Evaluate a condition against a context. Total, side-effect-free — the whole point of the closed AST. */
export function evaluate(cond: Condition, ctx: RoutingContext): boolean {
  switch (cond.kind) {
    case "channelIs":
      return ctx.channel === cond.value;
    case "subjectContains":
      return ctx.subject.toLowerCase().includes(cond.value.toLowerCase());
    case "bodyContains":
      return ctx.bodyText.toLowerCase().includes(cond.value.toLowerCase());
    case "attrEquals":
      // Reading an allowlisted key only; an unknown key can't be constructed (the type forbids it) and a
      // missing value simply doesn't match — no prototype access, no injection surface.
      return CONTACT_ATTR_KEYS.includes(cond.key) && ctx.contactAttrs[cond.key] === cond.value;
    case "all":
      return cond.of.every((c) => evaluate(c, ctx));
    case "any":
      return cond.of.some((c) => evaluate(c, ctx));
    case "not":
      return !evaluate(cond.of, ctx);
  }
}

// ── First-match evaluation + preview ─────────────────────────────────────────────────────────────
export interface RoutingDecision {
  matchedRuleId: string | null;
  actions: Action[];
  /** Preview trace: every enabled rule in order and whether it matched — the "why did this route here" view. */
  trace: Array<{ ruleId: string; order: number; matched: boolean }>;
}

/**
 * 📘 FIRST-MATCH-WINS with explicit ordering. Rules are sorted by `order`; the first enabled rule whose
 * condition matches wins and no later rule runs. This is a PRODUCT decision (vs cumulative all-match or
 * weighted scoring) — document it, because an admin who assumes the other semantics will be very confused.
 * 🔍 The `trace` makes routing explain itself; a rule engine without it generates unanswerable tickets.
 */
export function route(rules: readonly RoutingRule[], ctx: RoutingContext): RoutingDecision {
  const ordered = [...rules].filter((r) => r.enabled).sort((a, b) => a.order - b.order);
  const trace: RoutingDecision["trace"] = [];
  for (const rule of ordered) {
    const matched = evaluate(rule.condition, ctx);
    trace.push({ ruleId: rule.id, order: rule.order, matched });
    if (matched) return { matchedRuleId: rule.id, actions: rule.actions, trace };
  }
  return { matchedRuleId: null, actions: [], trace };
}

// ── Assignment strategies ──────────────────────────────────────────────────────────────────────
/**
 * 📘 Round-robin via a PERSISTED CURSOR, not `Math.random()`. Fairness is then a testable property: over N
 * assignments each of k agents gets ⌈N/k⌉ or ⌊N/k⌋. Random only converges in expectation and flakes tests.
 */
export function roundRobin(agentIds: readonly string[], cursor: number): { agentId: string; nextCursor: number } {
  if (agentIds.length === 0) throw new Error("roundRobin: no agents");
  const idx = ((cursor % agentIds.length) + agentIds.length) % agentIds.length; // safe for negative cursors
  return { agentId: agentIds[idx], nextCursor: cursor + 1 };
}

/**
 * Load-aware distribution: assign to the agent with the fewest open conversations. In-memory model to show the
 * race and its fix (🔗 the counter race, in every course now — S02 identity, S04 claim, here again).
 */
export class LoadBalancer {
  private readonly open = new Map<string, number>();
  constructor(agentIds: readonly string[], seed: Readonly<Record<string, number>> = {}) {
    for (const id of agentIds) this.open.set(id, seed[id] ?? 0);
  }
  loadOf(agentId: string): number {
    return this.open.get(agentId) ?? 0;
  }
  private leastLoaded(): string {
    let best: string | null = null;
    let bestLoad = Infinity;
    for (const [id, load] of this.open) {
      if (load < bestLoad) {
        best = id;
        bestLoad = load;
      }
    }
    if (best === null) throw new Error("LoadBalancer: no agents");
    return best;
  }

  /**
   * ⚠️ NAIVE: pick the least-loaded agent, then (later) increment. Two conversations routed at once both read
   * the same minimum and both pick the SAME agent — the load counter never reflecting the in-flight pick. The
   * `beforeCommit` hook exposes the window.
   */
  async pickNaive(beforeCommit = async () => {}): Promise<string> {
    const chosen = this.leastLoaded();
    await beforeCommit(); // <-- race window: another pick runs here and also chooses `chosen`
    this.open.set(chosen, (this.open.get(chosen) ?? 0) + 1);
    return chosen;
  }

  /**
   * The fix: pick AND increment as one indivisible step (models `UPDATE … SET open = open + 1 WHERE id =
   * (SELECT least-loaded …)` in a single statement, or a `SELECT … FOR UPDATE` + increment in one txn). No
   * window between choosing and committing, so concurrent picks spread across agents.
   */
  pickAndAssign(): string {
    const chosen = this.leastLoaded();
    this.open.set(chosen, (this.open.get(chosen) ?? 0) + 1);
    return chosen;
  }
}

// ── Business hours (timezone-aware) ──────────────────────────────────────────────────────────────
/** A weekly schedule: for each weekday (0=Sun..6=Sat), open/close minutes-from-midnight in the given offset. */
export interface BusinessHours {
  /** Minutes to ADD to UTC to get local time (e.g. New York standard = -300). DST caveat: see note below. */
  utcOffsetMinutes: number;
  /** Per-weekday windows in LOCAL minutes-from-midnight; a day with no window is closed. */
  windows: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, { openMin: number; closeMin: number }>>;
}

/**
 * 🔗 Timezone handling — the cross-course villain. The discipline: convert the UTC instant to LOCAL wall-clock
 * ONCE, explicitly, then compare in local terms. We take the offset as data (not `new Date()` magic) so the
 * function is pure and the tests pin exact instants. (DST is a fixed-offset simplification here; a production
 * build resolves the offset from an IANA zone via `Intl` at the instant — the *shape* of "instant → local →
 * compare" is unchanged.)
 */
export function isWithinBusinessHours(hours: BusinessHours, utcInstant: Date): boolean {
  const localMs = utcInstant.getTime() + hours.utcOffsetMinutes * 60_000;
  const local = new Date(localMs);
  const weekday = local.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6; // getUTC* because we already shifted into local
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const window = hours.windows[weekday];
  return window ? minutes >= window.openMin && minutes < window.closeMin : false;
}
