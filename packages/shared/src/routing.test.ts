import { describe, it, expect } from "vitest";
import {
  evaluate,
  route,
  roundRobin,
  LoadBalancer,
  isWithinBusinessHours,
  type RoutingRule,
  type RoutingContext,
  type BusinessHours,
} from "./routing";

const ctx = (over: Partial<RoutingContext> = {}): RoutingContext => ({
  channel: "email",
  subject: "Help with billing",
  bodyText: "my invoice is wrong",
  contactAttrs: { plan: "pro" },
  ...over,
});

describe("condition AST evaluation (S06)", () => {
  it("evaluates leaf, all/any/not combinators", () => {
    expect(evaluate({ kind: "channelIs", value: "email" }, ctx())).toBe(true);
    expect(evaluate({ kind: "subjectContains", value: "BILLING" }, ctx())).toBe(true); // case-insensitive
    expect(evaluate({ kind: "attrEquals", key: "plan", value: "pro" }, ctx())).toBe(true);
    expect(evaluate({ kind: "attrEquals", key: "plan", value: "free" }, ctx())).toBe(false);
    expect(
      evaluate({ kind: "all", of: [{ kind: "channelIs", value: "email" }, { kind: "bodyContains", value: "invoice" }] }, ctx()),
    ).toBe(true);
    expect(evaluate({ kind: "not", of: { kind: "channelIs", value: "messenger" } }, ctx())).toBe(true);
  });

  it("a missing allowlisted attr simply doesn't match (no throw, no prototype access)", () => {
    expect(evaluate({ kind: "attrEquals", key: "vip", value: "true" }, ctx({ contactAttrs: {} }))).toBe(false);
  });
});

describe("first-match routing + preview trace (S06)", () => {
  const rules: RoutingRule[] = [
    { id: "r-vip", order: 10, enabled: true, condition: { kind: "attrEquals", key: "vip", value: "true" }, actions: [{ type: "setPriority", priority: "urgent" }] },
    { id: "r-billing", order: 20, enabled: true, condition: { kind: "subjectContains", value: "billing" }, actions: [{ type: "assignTeam", teamId: "team-billing" }] },
    { id: "r-catchall", order: 99, enabled: true, condition: { kind: "channelIs", value: "email" }, actions: [{ type: "assignTeam", teamId: "team-general" }] },
  ];

  it("returns the first enabled matching rule by order and stops", () => {
    const d = route(rules, ctx()); // not vip, but subject has billing
    expect(d.matchedRuleId).toBe("r-billing");
    expect(d.actions).toEqual([{ type: "assignTeam", teamId: "team-billing" }]);
    // trace shows r-vip evaluated (no match) then r-billing (match); r-catchall never runs
    expect(d.trace).toEqual([
      { ruleId: "r-vip", order: 10, matched: false },
      { ruleId: "r-billing", order: 20, matched: true },
    ]);
  });

  it("disabled rules are skipped; no match → empty decision", () => {
    const d = route(
      rules.map((r) => ({ ...r, enabled: false })),
      ctx(),
    );
    expect(d.matchedRuleId).toBeNull();
    expect(d.actions).toEqual([]);
  });
});

describe("round-robin fairness (S06)", () => {
  it("distributes evenly over N via the persisted cursor", () => {
    const agents = ["a", "b", "c"];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    let cursor = 0;
    for (let i = 0; i < 30; i++) {
      const { agentId, nextCursor } = roundRobin(agents, cursor);
      counts[agentId]++;
      cursor = nextCursor;
    }
    expect(counts).toEqual({ a: 10, b: 10, c: 10 }); // exact, because it's a cursor not randomness
  });
});

describe("load-aware assignment race (S06)", () => {
  it("NAIVE pick-then-commit piles two conversations on the same agent", async () => {
    const lb = new LoadBalancer(["a", "b"], { a: 0, b: 0 });
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const p1 = lb.pickNaive(() => gate); // stalls after choosing
    const p2 = lb.pickNaive(); // also chooses the least-loaded — same agent
    const c2 = await p2;
    release();
    const c1 = await p1;
    expect(c1).toBe(c2); // 💥 both picked the same agent; the other got nothing
  });

  it("atomic pick-and-assign spreads concurrent picks across agents", () => {
    const lb = new LoadBalancer(["a", "b"], { a: 0, b: 0 });
    const first = lb.pickAndAssign();
    const second = lb.pickAndAssign();
    expect(new Set([first, second]).size).toBe(2); // one each
  });
});

describe("business hours (timezone-aware) (S06)", () => {
  const nyMonToFri9to17: BusinessHours = {
    utcOffsetMinutes: -300, // NY standard time
    windows: { 1: { openMin: 540, closeMin: 1020 }, 2: { openMin: 540, closeMin: 1020 }, 3: { openMin: 540, closeMin: 1020 }, 4: { openMin: 540, closeMin: 1020 }, 5: { openMin: 540, closeMin: 1020 } },
  };

  it("is open Tuesday 10:00 NY, closed at 20:00 NY and on the weekend", () => {
    // Tue 2024-01-02 15:00 UTC = 10:00 NY → open
    expect(isWithinBusinessHours(nyMonToFri9to17, new Date("2024-01-02T15:00:00Z"))).toBe(true);
    // Tue 2024-01-03 01:00 UTC = Tue 20:00 NY (prev day) → after close
    expect(isWithinBusinessHours(nyMonToFri9to17, new Date("2024-01-03T01:00:00Z"))).toBe(false);
    // Sun 2024-01-07 15:00 UTC = 10:00 NY Sunday → closed (no window)
    expect(isWithinBusinessHours(nyMonToFri9to17, new Date("2024-01-07T15:00:00Z"))).toBe(false);
  });
});
