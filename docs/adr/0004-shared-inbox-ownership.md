# ADR-0004 — Shared-inbox ownership: soft ownership + presence, not a hard lock

**Status:** accepted (S04) · **Deciders:** Harbor course

## Context

A shared inbox has many agents and one queue. Two failure modes overlap:

1. **The data race** — two agents claim the *same unassigned conversation* at the same instant. Whatever we
   store, exactly one must win, with no silent overwrite.
2. **The social race** — two agents *work* the same conversation (both typing a reply), wasting effort or
   contradicting each other.

The question this ADR settles: do we prevent the social race with an **exclusive lock** (only the assignee may
act, others are blocked), or with **soft ownership + visible presence** (assignment is a hint; anyone can act;
we surface who's here)?

## Decisions

### 1. The data race is solved atomically (not up for debate)
Claiming is a **compare-and-set**: `UPDATE conversation SET assigneeId = $me WHERE id = $id AND assigneeId IS
NULL`, then check affected rows. One row ⇒ you won; zero rows ⇒ someone beat you ⇒ a clean **409
ALREADY_CLAIMED** carrying the winner's id. Read-then-write is *wrong* here — both readers see `null` and both
write. This is modeled and tested as a pure race in `@harbor/shared` (`InboxAssignments.claimNaive` fails the
concurrent test; `claim` passes it) so the fix has a proof, not a vibe.

### 2. The social race is solved with soft ownership + presence (the debate)

- **Exclusive lock:** the assignee alone may reply; others are read-only until release/timeout.
  - ✅ Impossible to double-work. ❌ **Abandoned locks** (agent goes to lunch mid-conversation), lock-timeout
    tuning, "request unlock" flows, and managers unable to jump in. Locks convert a rare collision into a
    constant coordination tax.
- **Soft ownership + presence (chosen):** a claim assigns you and is the *default* actor, but it's a hint, not
  a mutex. Anyone can reassign or chime in; the UI shows **"👤 Dana is viewing / typing"** so collisions are
  prevented *socially*, the way they are at a physical help desk.
  - ✅ No abandoned-lock class of bugs; managers and teammates can always step in; matches how support teams
    actually work. ❌ A genuine simultaneous double-reply is *possible* — made rare by presence, and caught by
    the audit trail (every assignment is an `Assignment` row).

**Resolution:** **soft ownership + presence.** Solve the *data* race with the database (atomic claim); solve the
*social* race with *visibility*, not locking. Don't reach for a lock to fix a coordination problem a presence
indicator solves more cheaply.

### 3. Internal notes are non-emailable by type
Orthogonal but shipped here: an internal note and a customer reply share a composer but not a code path.
`isEmailable(kind)` is false for a note, so a note is `emailed:false` on the send path irrespective of UI — the
"private note sent to the customer" catastrophe is prevented by type, asserted by E2E, not left to a colored box.

## Consequences

- `Conversation.assigneeId` (nullable) + an `Assignment` audit model (who assigned whom, when) — releases are
  rows too. The audit trail is how we reconstruct a contested conversation without a lock.
- Real-time is **SSE**: one-way server→client fan-out, "events are hints, refetch for truth." WebSockets are
  reserved for the messenger widget's two-way channel (S05).
- **Deferred / foreshadowed:** we *set* outbound In-Reply-To/References here but still thread inbound on subject
  (ADR-0003) — the header-threading harvest lands in S13.
- **Links:** the S04 design thread (exclusive lock vs collaborative); `packages/shared/src/conversation.ts`;
  Tracer S6 (the approval race this rhymes with).
