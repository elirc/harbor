# Sprint 14 — Bot Autonomy, Handoff & Polish

**Branch:** `sprint-14/autonomy-handoff` · **Size:** M/L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Let the bot act — carefully. Confidence-gated auto-reply for high-certainty answerable questions, clean human handoff with full context, agent-facing AI assists (summarize, draft, tone), plus the accessibility and UX polish pass. Autonomy is *earned by eval*, bounded, and reversible.

## A — Issues
1. `Autonomy: confidence-gated auto-reply (eval-proven safe subset only), per-workspace controls`
2. `Handoff: bot → human with conversation summary + attempted-answer context`
3. `Agent AI assists: conversation summary, reply draft, tone/grammar adjust`
4. `Accessibility + UX polish (inbox, widget, help center)`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(bot): autonomy gate — auto-reply only when (retrieval strong) AND (confidence high) AND (topic allowlisted); everything else drafts-for-human` | autonomy is a *narrow, eval-validated* subset; the gate's thresholds come from S12's eval, not a guess |
| 2 | `feat(eval): autonomy safety eval — the auto-reply subset must hit near-zero wrong-answer rate before the gate opens` | opening autonomy is an eval decision with a committed score; a false-answer in auto mode is the worst outcome, so the bar is highest here |
| 3 | `feat(bot): handoff — on refusal/low-confidence/user-request, hand to human with summary + citations + what the bot tried` | the human inherits context, not a cold start; 🔗 the bot's transparency is the handoff's value |
| 4 | `feat(bot): auto-reply controls — per-workspace on/off, topic allowlist, business-hours-only, always-CC-an-agent options` | admins control autonomy; safe defaults (off, or draft-only) |
| 5 | `feat(assist): agent AI tools — summarize long thread, draft reply from context, adjust tone` | assists are agent-triggered, low-risk (human always edits/sends) |
| 6 | `feat(a11y): accessibility pass — inbox keyboard nav, widget a11y (screen-reader chat), help center (fast-forward patterns)` | 🔗 Meridian/Tracer a11y lessons; the widget's live messages need polite live regions (Tracer S14 real-time-a11y lesson) |
| 7 | `feat(web): UX polish — empty/loading/error states, mobile widget, dark mode (fast-forward)` | |
| 8 | `test(e2e): high-confidence Q auto-answered+CC'd; low-confidence handed off with context; keyboard-only inbox` | |
| 9 | `docs: ADR-0012 autonomy gating policy; curriculum note` | |

## C — Review order
The autonomy gate (1) + its safety eval (2) → handoff context (3) → admin controls (4) → a11y (6).

## D — Teaching comments (~10)
- autonomy earned by eval — 📘 the culmination of the eval-first thesis: the bot acts autonomously *only* on a subset proven safe by a committed eval score; "confident enough to act" is a measured threshold, not a product-manager's optimism
- narrow allowlist — 🔍 review-lens: autonomy scoped to allowlisted topics + strong retrieval + high confidence is three gates in series; each narrows blast radius; 🔗 the S13 least-privilege stance, now the autonomy design
- handoff context — 📘 a handoff that drops context makes the human start over and the customer repeat themselves; the summary + what-the-bot-tried is the entire value of handoff
- always-CC option — 📘 graduated autonomy: many teams want "auto-reply but CC an agent" as a trust-building middle stage; the product should support the *adoption curve*, not just on/off
- assists are low-risk — 📘 human-triggered, human-sent AI (summarize/draft) is the safe entry point; contrast auto-reply's high bar — risk scales with autonomy, and so should the eval rigor
- real-time widget a11y — 🔗 Tracer S14: announcing incoming bot/agent messages to screen readers politely; the live-region rate-limiting lesson transfers

## E — Debate
**"Auto-reply default: on for high-confidence vs off until admin opts in?"** On: immediate value, deflection. Off: safe, slower adoption. **Resolution:** off by default; admins opt in per topic after reviewing the safety eval, with "draft-only" and "auto+CC" intermediate stages. Lesson: *autonomy is a trust ladder the customer climbs deliberately — ship the rungs (off → draft → auto+CC → auto), not just the top.*

## F/G — Close
- Squash: `feat(sprint-14): bot autonomy, handoff, agent assists, polish (closes #…)`
- Deferred: proactive messages, multilingual bot, voice/tone customization per brand.
- Recap idea: *let AI act only where an eval proves it safe, scope it narrowly, and always leave a clean path back to a human.*
