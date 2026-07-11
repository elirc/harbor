# Curriculum Note — Sprint 4: The Shared Inbox (Conversations, Assignment, Real-time)

## Learning objectives
- Model a **shared inbox as a concurrency problem** — the friendly UI hides a two-writer race.
- Build an **atomic claim** and feel why read-then-write is not enough, with a test that proves the race.
- Enforce the **never-email-an-internal-note** rule *by type*, not by discipline.
- Wire **real-time** (SSE) with the "events are hints, refetch for truth" rule.

## Key concepts
- **📘 A conversation is an explicit state machine.** open → pending/snoozed/closed, with one write path and
  only valid transitions. An inbound message reopens. Anything unlisted is rejected, so state can't drift into
  nonsense. 🔗 Meridian's "make illegal states unrepresentable," restated for support.
- **⚠️ The double-claim race.** Two agents click *Claim* on one unassigned conversation. Read-then-write:
  both read `assignee = null`, both write their own id, both think they won — the second silently overwrites
  the first. The fix is an **atomic compare-and-set**: `UPDATE conversation SET assigneeId = $me WHERE id = $id
  AND assigneeId IS NULL` plus an affected-rows check. Zero rows affected ⇒ you lost ⇒ a clean 409
  ALREADY_CLAIMED, never a silent overwrite. 🔗 The Tracer S6 approval race, support-shaped.
- **🔍 Prove the race before you fix it.** The naive claim ships first with a test that FAILS by design — two
  concurrent claims *both* succeed. That red test is the specification for the fix; the green test after is the
  proof. A race you can't reproduce is a race you can't be sure you fixed.
- **⚠️ The highest-stakes bug in support: a note sent to the customer.** An internal note is for colleagues;
  a reply goes to the customer. We prevent the mix-up **by type** — `isEmailable(kind)` is false for a note,
  so a note is `emailed:false` on the send path regardless of UI state, and an E2E asserts it never leaves the
  building. Colored boxes help humans; the type system is what actually guarantees it.
- **📘 Canned replies interpolate, never evaluate.** `{{contact.name}}` is a literal path substitution over a
  plain object — no eval (🔗 Relay S4), and read **own properties only** so `{{constructor}}` / `{{__proto__}}`
  can't leak the prototype chain into a customer-facing reply. "No eval" isn't the whole rule; "don't walk the
  prototype" is the other half.
- **📘 Real-time = events are hints, the server is truth.** SSE tells the inbox "something changed"; the client
  **refetches** rather than trusting the event to carry a full snapshot. Simpler, and correct under reconnect
  and dropped frames. 🔗 The Tracer board's "notifications, not state."
- **📘 Threading, both directions.** We *set* In-Reply-To/References on outbound replies so the customer's
  client threads them — the mirror of the inbound threading S03 deferred. (Setting them on the way out is a
  reminder we should *consume* them on the way in: foreshadowing S13's threading-by-headers harvest.)

## The debate, cashed
**Exclusive lock vs collaborative ownership?** (See the PR's design thread and ADR-0004.) Resolved:
**soft ownership + visible presence.** A claim assigns you, but it's a hint to colleagues, not a mutex — anyone
can reassign, and presence ("👤 Dana is viewing") prevents collisions socially. A hard lock creates
abandoned-lock and lock-contention problems worse than the collisions it prevents. The *data* race (two writes
to one row) is still solved atomically; the *social* race (two people working one thread) is solved with
visibility, not locking.

## ⚗️ Lab (`lab/sprint-04`)
Add a third agent and a *reassignment* race: A claims, B reassigns to themselves, A's UI is stale. Make the
presence indicator and the SSE refetch resolve it without a hard lock. Then try to send an internal note to the
customer through the API directly — prove you can't.

## Exercise questions
1. Write the failing test for the naive claim: two concurrent claims that both succeed. What exactly makes it
   pass once the claim is atomic?
2. `UPDATE … WHERE assigneeId IS NULL` returns an affected-row count. Why is that count the whole safety
   mechanism? What breaks if you check `SELECT` then `UPDATE` instead?
3. Why enforce note-vs-reply by type rather than by a UI flag? Sketch the code path where a UI-only guard leaks.
4. `renderCanned("{{__proto__}}", {})` — what does a naive `vars[path]` return, and why is that a security bug
   in a customer-facing string?
5. SSE dropped a frame during a reconnect. Explain why "refetch on every event" survives that and "apply the
   event payload" doesn't.

## Further reading
- Optimistic concurrency / compare-and-set · Postgres `UPDATE … RETURNING` and affected rows · SSE vs
  WebSockets for one-way fan-out · ADR-0004 (soft ownership) · Tracer S6 (the approval race).
