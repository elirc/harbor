# Sprint 03 — Inbound Email: MIME, Threading & Reply Stripping

**Branch:** `sprint-03/inbound-email` · **Size:** L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** The email swamp. Parse real MIME (multipart, HTML+text, attachments, encodings), strip quoted replies and signatures, and reconstruct conversation threads — against a mock inbound provider that serves genuinely messy real-world emails. This is where juniors learn that email is not a solved problem.

## A — Issues
1. `packages/mailin: MIME parsing — multipart, HTML/text, charset, attachments`
2. `Reply & signature stripping (quoted-text detection across client styles)`
3. `Threading: attach inbound email to the right conversation`
4. `Mock inbound provider + a corpus of nasty real-world-shaped emails`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(mailin): MIME parser — multipart walk, charset decode, HTML+text extraction, attachment handling` | encodings (quoted-printable, base64, non-UTF8) — the corpus includes them all |
| 2 | `feat(test): nasty-email corpus — Outlook, Gmail, Apple Mail, mobile, forwarded chains, on-behalf-of` | the corpus is the sprint's real asset; each email documents its trap |
| 3 | `feat(mailin): reply stripping — quoted-block detection (>, "On … wrote:", client-specific markers)` | **[flaw #1]** threading (next commit) keys on Subject similarity, not headers |
| 4 | `feat(mailin): threading — [Subject-based] match inbound to open conversation` | works on the happy path; the flaw: "Re: Re: Fwd:" and shared subjects ("Invoice") misthread (harvest S7/S13) |
| 5 | `feat(mailin): signature stripping (heuristic + delimiter)` | best-effort, documented as best-effort |
| 6 | `feat(api): inbound pipeline — provider webhook → parse → resolve contact (S2) → thread → Message` | |
| 7 | `feat(web): email messages render cleanly (stripped) with "show quoted"/"show original" toggles` | never lose the original — display-strip, store-raw |
| 8 | `test(mailin): corpus regression — parsing, stripping, threading assertions per email` | golden-ish: each nasty email has expected parsed output |
| 9 | `docs: ADR-0003 email parsing approach + "email is not a solved problem" primer; curriculum note` | |

## C — Review order
The corpus (2) — read the emails and their traps first → parser (1) → reply stripping (3) → threading (4, and note what it keys on).

## D — Teaching comments (~11)
- MIME walk — 📘 an email is a tree, not a string: multipart/alternative, multipart/mixed, nested forwards; the recursive walk and where naive parsers break
- charset decoding — ⚠️ the mojibake museum: non-UTF8, mislabeled charsets, encoded-word headers (`=?UTF-8?B?…?=`); decode defensively, store raw
- reply stripping heuristics — 📘 there is no standard for quoted text; every client differs; heuristics + a "show original" escape hatch is the honest design — perfection is impossible, so make imperfection recoverable
- threading on Subject — *(the flaw: a teaching comment here would give it away; instead a `🔗 connects` note says "threading is subtle — we'll revisit robustness" without admitting the bug)*
- display-strip, store-raw — 🔍 review-lens: never mutate the original; stripping is a *view*; the "show original" toggle is both UX and a debugging tool
- corpus-as-spec — 📘 for messy domains, a corpus of real inputs with expected outputs beats any amount of unit-test theorizing; the corpus grows every time production surprises you

## E — Debate
**"Thread by headers (References/In-Reply-To) vs subject/heuristics?"** Headers: correct when present, but forwards/some clients drop them. Subject: always available, frequently wrong. **Resolution (foreshadowing):** this sprint ships subject-based (simple, gets the demo working) — and the ADR notes headers are the robust answer, deferred. *(The flaw is that we shipped the weak one as if it were fine; S7/S13 harvest it.)* Lesson stated in S13: *choosing the available-but-wrong signal over the correct-but-sometimes-absent one is a decision to revisit, not a resolution.*

## F/G — Close
- Squash: `feat(sprint-03): inbound email parsing, stripping, threading (closes #…)`
- **Lab:** `lab/sprint-03` — the learner adds three new nasty emails to the corpus that break the current parser/threader and documents each failure (a hands-on "email is a swamp" exercise).
- Ledger: flaw #1 recorded.
- Recap idea: *email parsing is 10% MIME spec and 90% other people's clients — build a corpus and respect the swamp.*
