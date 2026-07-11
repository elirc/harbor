# ADR-0003 — Inbound email parsing, stripping & threading

**Status:** accepted (S03) · **Deciders:** Harbor course

## Context

Harbor receives customer email. Email is **not a solved problem**: real messages are nested MIME trees with a
zoo of encodings, quoted-reply conventions that differ per client, and threading signals that are sometimes
present and sometimes not. This ADR records how we parse, strip, and thread — and, honestly, where we
punted.

## Decisions

### 1. Parse the MIME tree, decode defensively, store raw
An email is a **tree, not a string** — we walk it recursively (multipart/alternative, multipart/mixed, nested
forwards), decode each leaf by its transfer-encoding (quoted-printable, base64) and charset, and extract
text/html/attachments. Encoded-word headers (`=?UTF-8?B?…?=`) are decoded; a broken encoded-word degrades to
its raw payload rather than throwing. We **keep the raw MIME** always.

### 2. Strip for display, never mutate the original
Reply-quote and signature stripping are **heuristics** (there is no standard for quoted text). We strip for
*display* and store the raw, exposing a **"show original" toggle** — both UX and a debugging tool. Signature
stripping via the RFC `-- ` delimiter is reliable; the heuristic fallback is documented as best-effort.
*Perfection is impossible, so make imperfection recoverable.*

### 3. Threading — **subject-based (for now)**
We match an inbound email to an open conversation by **normalized subject** (strip Re:/Fwd:, compare). This
gets the demo working and handles the common case.

> ⚠️ **Deferred: header-based threading.** The robust signal is `References` / `In-Reply-To` headers, which we
> already *parse* but do not yet *thread on*. Subject matching is the *available* signal; it is frequently
> *wrong* — "Re: Re: Fwd:" chains, and shared subjects like "Invoice" or "Support request" — merging
> unrelated conversations. We ship subject-based and revisit robustness later.

### The debate — thread by headers vs subject/heuristics?

- **Headers (References/In-Reply-To):** correct when present, but forwards and some clients drop them.
- **Subject/heuristics:** always available, frequently wrong.

**Resolution (foreshadowing):** ship subject-based now; note headers as the robust answer, deferred. The
lesson lands later: *choosing the available-but-wrong signal over the correct-but-sometimes-absent one is a
decision to revisit, not a resolution.*

## Consequences

- `packages/mailin` is entirely pure Node — the nasty-email corpus is a DB-less regression suite (`test:corpus`
  CI gate).
- The corpus grows every time production surprises us (**corpus-as-spec**).
- **Links:** the S03 debate thread; the corpus lab (`lab/sprint-03`).
