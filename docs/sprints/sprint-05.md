# Sprint 05 — Web Messenger Widget + Help Center → v0.5.0

**Branch:** `sprint-05/messenger-helpcenter` · **Size:** M/L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Ship the MVP: an embeddable messenger widget (iframe-isolated, <30KB loader) that end-users chat through, a public help center for articles, deploy, and v0.5.0. Second SDK-to-strangers sprint (🔗 Pulse S3 discipline), now with a postMessage bridge — and a planted trust flaw in it.

## A — Issues
1. `packages/messenger: loader script + iframe widget; open/close, send/receive, unread`
2. `Messenger channel: widget messages become conversations (identity via S2)`
3. `Help center: public articles, categories, public read site`
4. `Deploy + E2E + demo; v0.5.0`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(messenger): loader — tiny script injects an iframe; budget <30KB; async, non-blocking` | iframe isolation: the widget's CSS/JS can't collide with the host page — the reason iframe over inline |
| 2 | `feat(messenger): host↔iframe bridge over postMessage — open/close, resize, identify` | **[flaw #2]** bridge accepts postMessage without verifying `event.origin` (harvest S13) |
| 3 | `feat(messenger): chat UI in iframe — thread, composer, unread, connection recovery (SSE)` | |
| 4 | `feat(api): messenger channel — widget session → contact resolve (S2) → conversation; anonymous→identified` | 🔗 Pulse S3's anonymous-then-identify pattern, support-shaped |
| 5 | `feat(db+api): Article, Category; help center public site (SSR for SEO — the one place Harbor wants it)` | |
| 6 | `feat(web): article authoring in the agent app` | |
| 7 | `test(e2e): widget on a demo host page → message → appears in agent inbox → agent replies → shows in widget` | full-loop across the iframe boundary |
| 8 | `test(messenger): budget gate <30KB; never-throw on host page (Pulse S3 policy)` | |
| 9 | `ci+deploy: dockerfiles, deploy, health (fast-forward)` | |
| 10 | `docs: ADR-0004 iframe widget + postMessage design; curriculum note` | |

## C — Review order
Loader + iframe rationale (1) → the postMessage bridge (2, note what it doesn't check) → full-loop E2E (7).

## D — Teaching comments (~9)
- iframe isolation — 📘 embedding in strangers' pages: iframe sandboxes your styles/scripts from theirs (and theirs from yours); the tradeoff (postMessage plumbing) is worth the isolation — contrast Pulse's inline SDK, where isolation wasn't needed
- budget <30KB loader — 🔗 Pulse S3's bundle-budget discipline; the *loader* is tiny, the iframe app can be bigger (it loads lazily) — a two-tier size strategy
- postMessage bridge — *(silent on the missing origin check — flaw #2; a `📘 concept` note explains postMessage mechanics without flagging the hole, so S13's probe lands)*
- anonymous→identified — 🔗 third appearance (Pulse SDK, Tracer offline, now messenger); the widget starts anonymous, `identify()` upgrades — same identity arc
- help center SSR — 🔍 review-lens: Harbor's *one* SEO surface (public articles) justifies SSR here, where the agent app (behind auth) didn't — architecture follows the requirement, per case
- never-throw — 🔗 the widget is a guest on someone's marketing page; a crash there is their problem and your churn

## E — Debate
**"Widget: iframe vs inline (shadow DOM)?"** Inline+shadow DOM: lighter, no postMessage, but shadow DOM isolation is imperfect (inherited styles, global JS collisions) and you share the host's JS context. Iframe: full isolation, heavier, postMessage required. **Resolution:** iframe — support widgets run on wildly varied sites; full isolation prevents the "your widget broke our checkout" incident. Lesson: *when you can't predict the host environment, isolate hard.*

## F/G — Close
- Squash: `feat(sprint-05): messenger widget, help center, deploy (closes #…)`
- **Post-merge:** deploy → demo (widget on a page → inbox → reply) → tag **`v0.5.0`** → MVP retro.
- Ledger: flaw #2 recorded.
- Recap idea: *embedding in strangers' pages is a trust boundary — isolate your UI and verify every message that crosses back.*
