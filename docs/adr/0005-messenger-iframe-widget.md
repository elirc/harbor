# ADR-0005 — The messenger widget: iframe isolation + a typed postMessage bridge

**Status:** accepted (S05) · **Deciders:** Harbor course

## Context

Harbor ships an embeddable web messenger — a chat widget a customer pastes onto *their* site with one script
tag. We control none of those sites: their CSS, their global JS, their build tooling, their CSP are all
unknown and hostile-by-accident. Two questions: **how do we isolate our UI from theirs**, and **how do the two
sides communicate** once isolated?

## Decisions

### 1. Isolate with an **iframe**, not inline DOM + shadow DOM

- **Inline + shadow DOM:** lighter, no cross-context messaging — the widget is just elements on the host page.
  But shadow DOM isolation is *imperfect*: inherited/`::part` styles leak, `font-size`/`color` cascade in, and
  crucially the widget shares the host's **JS realm** — one global-polluting host script (an old `prototype.js`,
  a broken polyfill) can break the widget, and the widget's errors surface in the host's console.
- **iframe (chosen):** a separate document with its own CSS cascade and its own JS realm. Our styles cannot
  touch their checkout button; their globals cannot touch our widget. The cost is that the two sides can no
  longer call each other directly — they must talk over `postMessage`.

**Resolution: iframe.** When you cannot predict the host environment, isolate *hard*. The "your widget broke
our checkout" incident is unrecoverable trust damage; the postMessage plumbing is a one-time cost we pay in
this package. (Contrast Pulse's inline SDK, which ran in a first-party context where isolation wasn't needed —
architecture follows the trust boundary, per case.)

### 2. A tiny loader; the weight lives behind the iframe

The pasted script is a **featherweight loader** (budget **< 30KB**, gated in CI) that is `async` and
non-blocking and whose only job is to inject the iframe. The real widget UI loads lazily *inside* the iframe
and is not on that budget — a two-tier size strategy. Rule: **the loader never throws** into the host page; a
failure degrades to "no widget," never to a broken customer site.

### 3. A typed, namespaced postMessage envelope

Every message carries `protocol: "harbor-messenger/1"` and a `dir` (`host->widget` / `widget->host`), so a page
that hosts several widgets (or other libraries using postMessage) can tell whose traffic is whose, and each
side accepts only the direction meant for it. The bridge is pure (`PostTarget` + `MessageEventLike` seams) so
the whole protocol is unit-tested without a browser.

### The debate — iframe vs inline (shadow DOM)?

Recorded on the S05 PR. Summary: inline is lighter but leaks styles and shares the host's JS realm; iframe is
heavier but fully isolated. For a widget that runs on *arbitrary* third-party sites, full isolation wins.
**Lesson: when you can't predict the host environment, isolate hard.**

## Consequences

- `packages/messenger` is pure logic (protocol, bridge, session, loader) + a thin DOM entry — DB-less and
  browser-less in CI, with a budget gate.
- The widget reuses S02 identity (anonymous→identified) and the S04 SSE loop (agent replies stream back).
- **Trust boundary, noted:** every message crossing *back* from a host page into the widget originates in an
  environment we don't control. What the bridge verifies about those messages is a security question this ADR
  deliberately leaves open for the hardening sprint. *(See the S13 audit.)*
- **Links:** the S05 iframe-vs-inline debate; `packages/messenger`; Pulse S3 (the inline SDK contrast).
