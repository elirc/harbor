# Sprint 02 — Workspaces, Agents, Contacts & Identity

**Branch:** `sprint-02/workspaces-identity` · **Size:** M · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Fast-forward workspace/agent auth; the real material is contact identity — one human across email, messenger, and external ids — with a merge-race arc that echoes Pulse S6 (pattern recognition across courses).

## A — Issues
1. `Workspace + Agent auth (fast-forward)`
2. `Contact + Identity model: multiple emails/messenger-ids/external-id per contact`
3. `Identity resolution: inbound message resolves-or-creates a contact`
4. `Contact merge (manual + automatic on shared identifier)`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(db): Workspace, Agent, Team + auth (fast-forward, compressed)` | |
| 2 | `feat(db): Contact, Identity (type email|messenger|external, value, unique per workspace)` | |
| 3 | `feat(api): resolve-or-create contact on inbound identifier` | resolution at write (🔗 Pulse S6's decision, restated: resolve once, attach conversation) |
| 4 | `feat(api): contact merge — [naive], fold identities + conversations` | **[fix-later-in-PR]** concurrent merge race |
| 5 | `test(api): two inbound messages from a new user on two channels race → duplicate contacts, FAILS` | the Pulse S6 race, new domain — does the learner call it in prediction? |
| 6 | `fix(api): advisory lock on identifier + deterministic merge (oldest wins)` | commit body: "we solved this exact shape in Pulse S6; here it is again" |
| 7 | `feat(web): contact profile — identities, conversation history, merge UI` | |
| 8 | `test(api): merge idempotency; conversation reattachment; unique-identity enforcement` | |
| 9 | `docs: curriculum note sprint 02 (identity resolution across courses)` | |

## C — Review order
Resolution (3) → the race arc (4→5→6) → merge UI.

## D — Teaching comments (~8)
- resolve-at-write — 🔗 third course meeting identity resolution (Meridian workers, Pulse persons, now contacts); the pattern is stable — attach at ingest, merge deterministically, never rewrite history
- merge race — 🔍 review-lens: if you predicted this from the issue list, you've internalized the concurrency lesson; the fix is muscle memory now (advisory lock + deterministic winner)
- identity types — 📘 one contact, many identifiers; the unique constraint is per (workspace, type, value); email is not a primary key (people share, change, alias)
- conversation reattachment — ⚠️ merging contacts must move their conversations atomically; an orphaned conversation is a support incident
- deterministic winner — 📘 oldest-wins makes re-merges idempotent — the same reason as Pulse; deterministic conflict resolution is a recurring tool

## E — Debate
**"Auto-merge on shared email vs always require human confirmation?"** Auto: seamless, but a shared family email or a typo merges two people. Manual: safe, tedious. **Resolution:** auto-merge only on *verified* identifiers (confirmed email, authenticated messenger id), suggest-merge for weak signals. Lesson: *automatic identity merging must be gated on identifier strength — a wrong merge is nearly irreversible.*

## F/G — Close
- Squash: `feat(sprint-02): workspaces, agents, contact identity (closes #…)`
- Deferred: contact unmerge (hard!), company/account grouping.
- Recap idea: *identity is the same hard table in every product — Harbor's contacts are Pulse's persons wearing a support badge.*
