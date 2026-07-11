# Sprint 04 — Shared Inbox: Conversations, Assignment & Real-Time

**Branch:** `sprint-04/shared-inbox` · **Size:** L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** The agent workspace: a real-time shared inbox with conversation states, manual assignment (with a double-claim arc), internal notes, canned replies, and outbound email. SSE is fast-forwarded from Tracer/Pulse; the new tension is *shared* state — multiple agents on one inbox.

## A — Issues
1. `Conversation states (open/pending/snoozed/closed) + assignment to agent/team`
2. `Real-time inbox: SSE updates, presence ("agent viewing"), typing`
3. `Reply composer: outbound email send, internal notes, canned replies`
4. `Inbox views: unassigned, mine, team, filters`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(db): conversation state machine + Assignment history` | 🔗 Meridian S4 state-machine discipline; state changes audited |
| 2 | `feat(api): assignment — claim, assign, reassign; [naive claim]` | **[fix-later-in-PR]** two agents claim one unassigned conversation |
| 3 | `test(api): concurrent claim → both succeed, FAILS` | the shared-inbox race (🔗 Tracer S6 approval race, support-shaped) |
| 4 | `fix(api): claim via status precondition (UPDATE … WHERE assignee IS NULL)` | affected-rows check; the loser gets a clean "already claimed" |
| 5 | `feat(api): SSE inbox stream (fast-forward) — conversation + message events` | |
| 6 | `feat(web): inbox UI — list, thread, state controls, assignment, real-time updates` | |
| 7 | `feat(web): presence + typing (fast-forward ephemeral pattern from Tracer S9)` | "Ada is viewing", "Ravi is typing" — collision avoidance for agents |
| 8 | `feat(api+web): reply composer — outbound email (via mock provider), internal notes, canned replies` | notes are internal-only (never emailed) — the classic "replied publicly by mistake" bug prevented by design |
| 9 | `test(e2e): two-agent — one claims, the other sees it assigned live; note stays internal` | |
| 10 | `docs: curriculum note sprint 04` | |

## C — Review order
The claim arc (2→3→4) → SSE (5, skim — known) → internal-notes-never-emailed (8).

## D — Teaching comments (~9)
- claim precondition — 🔗 the same optimistic-concurrency fix as Tracer's approval race; `WHERE assignee IS NULL` + affected-rows; shared inboxes live or die on this
- state machine — 📘 conversation lifecycle as an explicit machine; snooze/reopen transitions and their triggers; one write path (Meridian's law, fifth appearance)
- presence for collision avoidance — 📘 in a shared inbox, presence isn't a nicety — it stops two agents answering the same person; ephemeral Redis state (Tracer S9 pattern)
- internal notes — ⚠️ the highest-stakes UI bug in support: a note meant for colleagues sent to the customer; separate types, separate rendering, separate send paths, and an E2E that asserts a note never leaves the building
- canned replies — 📘 templating with variable insertion (contact name, etc.) — 🔗 reuse a safe-interpolation approach (Relay S4's lesson: no eval)
- outbound threading — 🔗 replies must set References/In-Reply-To so the *customer's* client threads correctly — foreshadows S3 flaw's fix (we should consume those headers too)

## E — Debate
**"Assignment: exclusive lock (one agent owns it) vs collaborative (anyone can reply)?"** Exclusive: clear ownership, but bottlenecks. Collaborative: flexible, but two agents reply at once. **Resolution:** soft ownership — assigned agent is the owner, but others can jump in with a visible presence warning; hard locks frustrate more than they protect. Lesson: *coordination in shared tools is better served by visibility than by locks — show, don't forbid* (🔗 Tracer's collaboration philosophy, restated).

## F/G — Close
- Squash: `feat(sprint-04): shared inbox, assignment, real-time (closes #…)`
- Deferred: bulk actions, keyboard shortcuts (S14 polish), saved inbox views.
- Recap idea: *a shared inbox is a concurrency problem with a friendly face — claims, presence, and never-email-the-note.*
