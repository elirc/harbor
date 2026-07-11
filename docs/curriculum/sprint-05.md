# Curriculum Note — Sprint 5: The Messenger Widget + Help Center (→ v0.5.0)

## Learning objectives
- Ship code onto **strangers' pages** and defend both directions of the trust boundary.
- Choose **iframe isolation** deliberately, and pay its one cost (postMessage) with a clean, typed protocol.
- Enforce a **size budget** and a **never-throw** policy on third-party code.
- Recognize when **SSR is the right tool** (a public SEO surface) and when it isn't (the authed agent app).

## Key concepts
- **📘 Embedding in strangers' pages is a trust boundary — in both directions.** Their environment can break
  your widget (global JS, cascading CSS); your widget can break their page (a thrown error, a style leak). An
  **iframe** gives you a separate CSS cascade and a separate JS realm, so neither can reach the other. The cost
  is that the two sides can only talk over `postMessage` — which is a feature: a boundary you can *see* and
  *audit*, not an accidental shared scope. 🔗 Contrast Pulse's inline SDK (first-party, isolation unneeded).
- **📘 postMessage, precisely.** `target.postMessage(data, targetOrigin)` structured-clones `data` into another
  browsing context and fires a `message` event there; the receiver reads `event.data`, `event.origin`, and
  `event.source`. Because the contexts are different origins, this is the *only* channel. We wrap it in a typed,
  namespaced envelope so unrelated traffic is ignored by shape and each side accepts only its direction.
- **🔗 A two-tier size budget.** The pasted loader is featherweight (< 30KB, CI-gated) and only injects the
  iframe; the heavy UI loads lazily *inside* the iframe, off-budget. 🔗 Pulse S3's bundle-budget discipline,
  now split across a boundary.
- **🔗 Never throw on a guest page.** A crash in someone else's site is their incident and your churn. Every
  entry point is wrapped; failure degrades to "no widget."
- **🔗 anonymous → identified, third appearance.** The widget starts anonymous (a `messenger` identity keyed on
  a session id); `identify()` folds that session onto the real contact — the exact S02 resolve-or-create +
  merge, reused. Build identity once, spend it everywhere.
- **🔍 SSR where the requirement asks for it.** The public help center lives or dies by search ranking, so it
  **server-renders** (Harbor's one SSR surface). The agent app is behind auth and needs no SEO, so it stays a
  SPA. Architecture follows the requirement per surface — not a blanket "SSR everything" or "SPA everything."
- **🔍 Escape before you interpolate.** Article bodies are authored text rendered onto a *public* page; drop
  them into HTML raw and you have stored XSS. `escapeHtml` + published-only are the invariants.

## The debate, cashed
**iframe vs inline (shadow DOM)?** Resolved: **iframe** — for a widget on arbitrary third-party sites, full
isolation beats a lighter-but-leaky shadow DOM. *When you can't predict the host environment, isolate hard.*
(ADR-0005.)

## A note you'll want later
This sprint crosses a trust boundary and builds the machinery to send messages *back* across it. Read the
postMessage bridge carefully and ask the security question the ADR leaves open: *what does the receiving side
actually verify about a message before acting on it?* Hold that thought — the hardening sprint comes for it.

## Milestone
**v0.5.0 — the MVP.** Inbound email → shared inbox → real-time → embeddable messenger → public help center. A
support team could run on this. Everything after is the AI product: knowledge base, evals, RAG, triage, the
answer-bot — and the discipline that *an LLM feature without an eval is a demo, not a product.*

## Exercise questions
1. Give a concrete way a host page could break an *inline* widget that an *iframe* widget survives. Now give the
   reverse: something the iframe makes *harder* for you (hint: sizing).
2. Why is the loader on a size budget but the in-iframe app is not? What would you put in each tier?
3. The widget starts anonymous and later calls `identify()`. Trace what happens to the messages sent while
   anonymous. Which S02 primitive does this reuse?
4. Why does the public help center server-render while the agent inbox doesn't? State the rule in one sentence.
5. Look at the bridge's `receive()`. List everything it checks about an incoming message — and everything it
   doesn't. Is that safe for a widget on any website? (Keep your answer; you'll test it in S13.)

## Further reading
- MDN `Window.postMessage` (esp. the `targetOrigin` and `event.origin` sections) · iframe `sandbox` &
  `allow` · shadow DOM isolation limits · ADR-0005 · Pulse S3 (the inline SDK).
