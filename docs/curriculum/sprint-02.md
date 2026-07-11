# Curriculum Note — Sprint 2: Workspaces, Agents & Contact Identity

## Learning objectives
- Model **one human across many identifiers** (email/messenger/external) as a single contact.
- Recognize the **merge race** from a prior course and fix it with muscle memory (advisory lock + deterministic winner).
- Internalize: identity is the same hard table in every product.

## Key concepts
- **Resolve at write (attach at ingest).** An inbound identifier resolves-or-creates a contact *once*, at
  ingest, and the conversation attaches to it. 🔗 Third course meeting identity resolution (Meridian's
  workers, Pulse's persons, now Harbor's contacts) — the pattern is stable: attach at ingest, merge
  deterministically, never rewrite history.
- **Email is not a primary key.** People share emails (family accounts), change them, and alias them. So a
  contact has *many* identities, unique per (workspace, type, value) — the identifier is unique, the human
  is not the identifier.
- **🔍 The merge race — did you predict it?** Two inbound messages from a brand-new user on two channels can
  both pass the "does this identity exist?" check before either creates → **two contacts for one person.** If
  you saw it coming from the issue list, you've internalized the concurrency lesson. The fix is muscle memory:
  an **advisory lock keyed on the identifier** serializes resolve-or-create (per-identifier, so different
  identifiers still run in parallel). 🔗 "We solved this exact shape in Pulse S6; here it is again."
- **⚠️ Reattachment must be atomic.** Merging contacts moves the loser's identities *and conversations* to the
  survivor in one transaction. An orphaned conversation (pointing at a deleted contact) is a support incident.
- **📘 Deterministic winner → idempotent merges.** Oldest contact wins, so merge(a,b) and merge(b,a) pick the
  same survivor and re-merging is a no-op. Same reason as Pulse: deterministic conflict resolution is a
  recurring tool.

## The debate, cashed
**Auto-merge on shared email vs always require human confirmation?** Resolved: **auto-merge only on *verified*
identifiers** (confirmed email, authenticated messenger session); *suggest*-merge for weak signals (an
unverified external id). *Automatic identity merging must be gated on identifier strength — a wrong merge is
nearly irreversible* (unmerge is deferred, and hard).

## Exercise questions
1. Predict the merge race from the issue list alone. Where exactly is the window between check and create?
2. Why is the advisory lock keyed on the *identifier* rather than global? What does that preserve?
3. Give a real scenario where auto-merging on a shared email would wrongly fuse two people.
4. Why does oldest-wins make re-merges idempotent, and why does idempotency matter here?

## Further reading
- Postgres advisory locks (`pg_advisory_xact_lock`) · "identity resolution / entity resolution" · Pulse S6
  (the same race) · the S02 debate thread.
