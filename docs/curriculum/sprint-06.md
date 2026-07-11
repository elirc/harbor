# Curriculum Note — Sprint 6: Routing & Assignment Engine

## Learning objectives
- Recognize the **closed-predicate AST** as a reusable shape — and reach for it without being told.
- Choose **explainable determinism** (first-match + preview) over flexible-but-opaque scoring.
- Reach for the **atomic counter fix** on reflex when distributing work.
- Handle **timezones** with the "instant → local → compare" discipline instead of hoping.

## Key concepts
- **🔗 The closed-predicate AST, fourth time.** Tracer filters, Pulse segments, Relay rules, now routing — the
  same discriminated union you *evaluate* over allowlisted fields, never a string you *eval*. The senior skill
  this repetition trains isn't writing the AST; it's *recognizing* that a new problem ("route conversations")
  has the shape of an old solved one. Notice how little routing's evaluator differs from the earlier three.
- **📘 Rule-engine semantics are a product decision.** First-match-wins (ordered override) vs all-match
  (cumulative) vs weighted scoring — these give different answers, and *admins will assume whichever one you
  didn't pick.* Document it. We chose first-match for explainability.
- **🔍 Debuggability is a feature, shipped early.** The preview/dry-run — "which rule fires, and why," with the
  full trace — is built before the rules get complex. A rule engine that can't explain itself turns every
  surprising route into an unanswerable ticket. Build the "why" view first.
- **⚠️ The counter race, yet again.** "Assign to the least-loaded agent" is check-then-act: two routes read the
  same minimum and pick the same agent. You've now seen this exact race in S02 (identity) and S04 (claim). The
  fix is muscle memory: make choose-and-commit atomic (advisory lock per team; `increment` the cursor). If you
  didn't feel the race coming when you read "least-loaded," reread S02 and S04.
- **📘 Fairness is testable when it's a cursor, not a coin.** Round-robin over a persisted cursor distributes
  exactly ⌈N/k⌉/⌊N/k⌋; `Math.random()` only converges in expectation and flakes the test. Determinism where you
  can have it.
- **🔗 Timezones, the cross-course villain.** Convert the instant to local wall-clock **once**, explicitly,
  then compare in local terms — and take the offset as *data* so the function stays pure and testable. The
  off-hours queue you build here is where next sprint's SLA clock will have to decide whether it ticks.

## The debate, cashed
**First-match-wins vs weighted scoring?** Resolved: **first-match + explicit ordering + preview**; scoring
deferred until a real need (which rarely comes). *Prefer explainable determinism in systems humans configure
and debug.* (ADR-0006.)

## Exercise questions
1. The `route()` function skips disabled rules and stops at the first match. Rewrite its contract for *all-match
   cumulative* semantics. What does the preview trace need to show differently?
2. Write the failing concurrency test for naive load-aware assignment (two routes, same least-loaded agent).
   What single change makes it pass, and why does the advisory lock scope to the *team*?
3. Why a persisted cursor instead of random for round-robin? Give the test that a random implementation can't
   pass deterministically.
4. `isWithinBusinessHours` takes the offset as an argument rather than reading the server clock. Give two
   reasons that makes it better, one about correctness and one about testing.
5. A condition can only read allowlisted attribute keys. Show the injection this prevents, and why the *type*
   (not a runtime check alone) is doing the work.

## Further reading
- Optimistic concurrency & `SELECT … FOR UPDATE` / advisory locks · rule-engine semantics (Drools, decision
  tables) · IANA timezones & `Intl.DateTimeFormat` offsets · ADR-0006 · Tracer S10 / Relay S8 (the AST lineage).
