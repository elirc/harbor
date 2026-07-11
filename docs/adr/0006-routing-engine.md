# ADR-0006 — Routing engine: first-match rules over a closed AST, fair atomic assignment

**Status:** accepted (S06) · **Deciders:** Harbor course

## Context

Conversations arrive and someone has to answer. Doing that by hand doesn't scale, so we automate it: rules map
conditions (channel, keywords, contact attributes, business hours) to actions (assign a team/agent, set
priority), and a strategy picks a specific agent within the chosen team. Two design questions carry risk: **how
are rules expressed and evaluated**, and **how is an agent chosen without piling work on one person**.

## Decisions

### 1. Conditions are a closed predicate AST — evaluated, never eval'd
A rule condition is a discriminated union (`channelIs`, `subjectContains`, `attrEquals`, `all`/`any`/`not`),
stored as JSON, validated by a Zod schema on write, and evaluated by one pure total function. Fields come from
an **allowlist** (`CONTACT_ATTR_KEYS`); a rule cannot reach arbitrary internals or execute code. 🔗 This is the
same shape as Tracer's filters, Pulse's segments, and Relay's rules — the fourth reuse. There is nothing to
`eval`, and the evaluator is identical in production and in tests.

### 2. First-match-wins with explicit ordering (the debate)

- **First-match-wins:** rules are ordered; the first match applies and the rest are skipped. Predictable,
  admin-controllable, trivially explainable.
- **Weighted scoring:** each rule contributes a score; highest total wins. Flexible, but "why did this route
  here?" becomes opaque — you're debugging a sum, not reading a list.

**Resolution: first-match-wins** + a **preview/dry-run** that returns the full trace (every enabled rule in
order and whether it matched). Scoring is deferred until a real need appears (it rarely does). *Prefer
explainable determinism in systems humans configure and debug.* A rule engine without a "why did this route
here" view generates unanswerable support tickets, so debuggability ships *before* the rules get complex.

### 3. Assignment is fair — and atomic
- **Round-robin** uses a **persisted cursor**, not `Math.random()`, so fairness is a *testable* property
  (exact distribution over N), not a statistical hope.
- **Load-aware** assigns to the agent with the fewest open conversations. ⚠️ "read the minimum, then assign" is
  a check-then-act race — two conversations routed at once both read the same minimum and land on the same
  agent (the **counter race**, seen in S02 identity and S04 claim). The fix: serialize picks per team with a
  Postgres **advisory lock** so choose-and-commit is one atomic step; the round-robin cursor is incremented
  atomically (`increment`). The pure `LoadBalancer` model demonstrates the race (`pickNaive`) and the fix
  (`pickAndAssign`).

### 4. Business hours are timezone-aware, done with discipline
Schedules are per-weekday local windows plus an explicit offset; `isWithinBusinessHours` converts the UTC
instant to local wall-clock **once**, then compares. 🔗 Timezones are the cross-course villain; the discipline
is "instant → local → compare," with the offset passed as *data* so the function is pure and pinned by tests.
(Fixed-offset here is a documented simplification; a production build resolves the IANA offset at the instant.)

## Consequences

- `packages/shared/src/routing.ts` is pure: AST + evaluator + strategies + hours, fully unit-tested (rule
  ordering, round-robin fairness over N, the load race, timezone boundaries).
- `RoutingRule` (JSON condition/actions) and `TeamCursor` (durable round-robin position) added to the schema;
  `Conversation` gains `assignedTeamId` + `priority`.
- **Deferred:** skill-based routing matrices; conversation-volume forecasting; contact CRM attributes (the
  `contactAttrs` context is wired but sourced empty until those fields land).
- **Foreshadow:** the off-hours queue is exactly where S07's SLA clock will need to decide whether it ticks.
- **Links:** the S06 first-match-vs-scoring debate; Relay S8 (structured UI → safe AST).
