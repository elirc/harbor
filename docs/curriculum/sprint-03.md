# Curriculum Note — Sprint 3: Inbound Email (MIME, Threading, Reply Stripping)

## Learning objectives
- Learn, viscerally, that **email is not a solved problem** — parse a real MIME tree with real encodings.
- Build **display-strip, store-raw** discipline: heuristics that are wrong sometimes, made recoverable.
- Practice **corpus-as-spec** for a messy domain.

## Key concepts
- **📘 An email is a tree, not a string.** multipart/alternative (text + HTML of one body), multipart/mixed
  (body + attachments), nested forwards. The recursive walk is the parser; `body.split("\n\n")` breaks on all
  of it. Decode each leaf by transfer-encoding + charset.
- **⚠️ The mojibake museum.** Non-UTF8, mislabeled charsets, encoded-word headers (`=?UTF-8?B?…?=`),
  quoted-printable (`=E2=80=94` → em-dash). Decode defensively — a broken encoded-word degrades to its raw
  payload, never throws — and keep the raw so a wrong guess is recoverable.
- **📘 There is no standard for quoted text.** Gmail's "On … wrote:", Outlook's "-----Original Message-----",
  `>` prefixes, localized variants. Stripping is heuristics; the honest design pairs them with a **"show
  original" escape hatch** — perfection is impossible, so make imperfection recoverable.
- **🔍 Display-strip, store-raw.** Stripping is a *view*. Never mutate the original. The "show original"
  toggle is both UX and a debugging tool.
- **📘 Corpus-as-spec.** For a messy domain, a corpus of real inputs with expected outputs beats any amount of
  unit-test theorizing. The corpus grows every time production surprises you — that's the point of the lab.
- **🔗 Threading is subtle — we'll revisit robustness.** We thread on normalized subject for now. (Whether
  that's the *right* signal is a question ADR-0003 flags for later.)

## The debate, cashed
**Thread by headers vs subject/heuristics?** Resolved (foreshadowing): ship subject-based now; ADR notes
headers (References/In-Reply-To) as the robust answer, deferred.

## ⚗️ Lab (`lab/sprint-03`)
Add three new nasty emails to the corpus that break the current parser or threader, and document each failure.
Email parsing is 10% MIME spec and 90% other people's clients — build a corpus and respect the swamp.

## Exercise questions
1. Take one corpus email and draw its MIME tree. Where would a naive string-split parser go wrong?
2. Why decode defensively (degrade, don't throw) and always keep the raw? Give a concrete recovery scenario.
3. Reply stripping is heuristic. Design the "show original" affordance — why is it a debugging tool too?
4. Threading matches on subject. Construct two *unrelated* emails that would wrongly thread together. (Hold
   that thought.)

## Further reading
- RFC 2045–2047 (MIME), RFC 3676 (`-- ` signature) · "email is hard" write-ups · ADR-0003.
