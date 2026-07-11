# Sprint 06 — Routing & Assignment Engine

**Branch:** `sprint-06/routing-engine` · **Size:** L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Automate who-answers-what: a rule engine (conditions → assignment), round-robin and load-aware distribution, business hours, and the foundation SLAs build on in S7. Reuses the filter-AST pattern (Tracer S10 / Pulse) a fourth time.

## A — Issues
1. `RoutingRule: condition AST (channel, contact attrs, keywords, hours) → action (assign team/agent, set priority)`
2. `Assignment strategies: round-robin, load-aware (fewest open), skills/team match`
3. `Business hours + timezone-aware routing`
4. `Rule evaluation on conversation create + re-evaluation triggers`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(db+shared): RoutingRule with condition AST (reuse the closed-predicate pattern)` | 🔗 fourth AST reuse across courses; fields are an allowlist (injection lesson, internalized) |
| 2 | `feat(api): rule evaluator — ordered rules, first-match or all-match, dry-run/preview` | preview: "which rule would fire for this conversation" — debuggability first (🔗 Relay's resolution-trace instinct) |
| 3 | `feat(api): assignment strategies — round-robin (fair cursor), load-aware (fewest-open, atomic)` | ⚠️ load-aware needs an atomic "pick least-loaded and increment" or two conversations pile on one agent (the counter race, again) |
| 4 | `feat(api): business hours + timezone; route to on-hours teams, queue off-hours` | 🔗 timezone handling, the cross-course villain — reuse the date discipline docs |
| 5 | `feat(api): re-evaluation — reassign on state change, agent-offline reassignment` | agent goes offline → their open conversations re-route (with a grace window) |
| 6 | `feat(web): rule builder (structured, compiles to AST) + assignment settings + preview` | 🔗 Relay S8's "structured UI → safe AST" lesson |
| 7 | `test(api): rule ordering, round-robin fairness over N, load-aware atomicity under concurrency` | |
| 8 | `test(e2e): inbound → rules assign to right team → load-balanced within team` | |
| 9 | `docs: ADR-0005 routing engine; curriculum note` | |

## C — Review order
The AST reuse (1) → evaluator + preview (2) → load-aware atomicity (3) → re-evaluation triggers (5).

## D — Teaching comments (~9)
- AST, fourth time — 🔗 by now the closed-predicate-AST pattern is a reflex; note how little this differs from Tracer/Pulse/Relay — *recognizing* the reusable shape is the senior skill this repetition builds
- first-match vs all-match — 📘 rule-engine semantics are a product decision (ordered override vs cumulative); document which, because admins will assume the other
- load-aware atomicity — ⚠️ "assign to the least-loaded agent" is a check-then-act race; the atomic pick-and-increment (or recompute-under-lock); 🔗 every course has this counter race — you should reach for the fix without thinking now
- round-robin fairness — 📘 a persisted cursor, not random; fairness is testable (distribution over N assignments)
- off-hours queueing — 📘 routing is timezone-and-calendar-aware; the off-hours queue is where S7's SLA clock does or doesn't tick
- preview/dry-run — 🔍 review-lens: a rule engine without a "why did this route here" preview generates unanswerable support tickets; debuggability is a feature, established before the rules get complex

## E — Debate
**"Rule evaluation: first-match-wins vs weighted scoring?"** First-match: predictable, admin-controllable ordering, but rigid. Scoring: flexible, but "why did this route here" becomes opaque. **Resolution:** first-match-wins with explicit ordering + the preview tool; scoring deferred until a real need (and it rarely comes). Lesson: *prefer explainable determinism in systems humans configure and debug.*

## F/G — Close
- Squash: `feat(sprint-06): routing & assignment engine (closes #…)`
- Deferred: skill-based routing matrices, conversation-volume forecasting.
- Recap idea: *routing is a rules engine plus a fair counter plus a calendar — and above all, it must explain itself.*
