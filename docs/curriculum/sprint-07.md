# Curriculum Note — Sprint 7: SLAs, Escalation & Reporting v1

## Learning objectives
- Measure a promise on a **business calendar**, and know why the calendar is where the bugs live.
- Make a repeating monitor **idempotent** so it adds attention instead of noise.
- Report the **tail** (percentiles), not the misleading average.
- Migrate a heuristic to a **robust signal** without breaking existing behavior (the flaw-#1 harvest).

## Key concepts
- **🔗 The SLA clock is a pure function, and business-time is subtle.** `businessMillisBetween` counts only
  in-hours minutes, walking day by day. Functional-core discipline (fourth course running): the calendar math
  is pure and property-testable, so weekend/overnight/DST-adjacent cases are pinned, not hoped.
- **⚠️ The clock pauses — that's a fairness decision, not an implementation detail.** An SLA that keeps ticking
  while you wait on the *customer* measures the customer's latency and blames the agent. Pausing on
  awaiting-customer (and off-hours) is a policy choice; document it (ADR-0007), because someone will assume the
  other rule and think the numbers are wrong.
- **🔗 A repeating monitor must fire once.** The escalation job runs every minute; without a sent-marker per
  (window, threshold) it re-alerts every run, and a channel that cries wolf gets muted — then it warns about
  *nothing*. Idempotency is the whole feature. 🔗 Meridian S10 catch-up semantics.
- **📘 Escalation adds attention before it changes ownership.** Tiered: warn the owner (75/90%), escalate to the
  lead on breach (notify, don't reassign), reassign only when the owner is offline. Auto-reassign churns
  context and may just move the problem to another swamped agent.
- **📘 Percentiles, not averages.** The mean of nine fast replies and one slow one describes no real customer.
  p50 is typical, p95 is the one about to churn. Report the distribution's tail. 🔗 Pulse.
- **📘 Harvesting flaw #1 (part 1): demote the heuristic, don't delete it.** S03 threaded on subject similarity
  — available but wrong (two customers' "Invoice" merged). The fix threads on the **Message-ID chain** (the
  correct signal we parsed all along) and keeps subject as a *fallback scoped to the sender's contact*, so its
  known failure can't happen. **🔍 The regression test is the harvest:** two contacts, same subject, stay
  separate — the exact failure the flaw caused. (Forwarded-chain edge cases wait for S13, part 2.)

## The debate, cashed
**SLA breach: auto-reassign vs alert-and-hold?** Resolved: **tiered** — pre-breach alerts to the owner, breach
notifies the team lead, reassignment only on agent-offline. *Escalation should add attention before it changes
ownership.* (ADR-0007.)

## ⚗️ Lab (`lab/sprint-07`, break-it)
Construct conversations that expose SLA-clock edge cases: a holiday the calendar doesn't know about, a timezone
flip across DST, rapid pending↔open toggles that thrash the pause intervals. Then construct the *remaining*
threading edge cases — a reply that drops `References`, a client that rewrites `Message-ID`, a forwarded chain —
and watch them misthread. (You're building the S13 case file.)

## Exercise questions
1. Write `businessMillisBetween` for a Friday-5pm → Monday-11am interval and hand-check the result. Where would
   a naive `(end - start)` be wrong, and by how much?
2. The escalation monitor runs every minute. Show the exact duplicate-alert bug that happens without
   `EscalationLog`, and why the marker's key is (window, threshold) and not just window.
3. Give a dataset where the average first-response time looks great and the p95 is a disaster. Which number
   would you put on the exec dashboard, and which on the agent's?
4. The threading harvest keeps subject matching as a fallback but scopes it to the contact. Construct the two
   emails that the *old* code merged and the *new* code separates. Which line is doing the work?
5. Why store `Message.messageId` on every inbound message even though we thread using the *incoming* email's
   headers? (Hint: what threads onto *this* message next week?)

## Further reading
- Working-time / business-calendar libraries · fire-once / idempotency keys · percentiles vs averages (p99
  latency culture) · RFC 5322 threading (`References`/`In-Reply-To`) · ADR-0007, ADR-0003 · Meridian S6/S10.
