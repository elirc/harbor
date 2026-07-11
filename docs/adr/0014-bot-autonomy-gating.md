# ADR-0014 — Bot autonomy: earned by eval, gated in series, always reversible

**Status:** accepted (S14) · **Deciders:** Harbor course

## Context

Until now every AI output has been supervised: triage *suggests*, the bot *drafts*, a human *sends*. That
supervision is also the security containment that made prompt injection harmless (ADR-0013). Letting the bot
*act* — auto-reply to a customer — removes that containment, so autonomy must be granted **only where an eval
proves it safe, scoped narrowly, and with a clean path back to a human.** This ADR records how.

## Decisions

### 1. Autonomy is earned by an eval, not by optimism
The bot auto-replies only on a subset whose **auto-answer wrong-rate is near-zero in a committed eval** — the
culmination of the eval-first thesis. A false answer in auto mode (nobody reviews it) is the worst possible
outcome, so the bar here is the highest in the whole product. "Confident enough to act" is a *measured
threshold*, and the thresholds come from S12's eval, not a product-manager's guess.

### 2. Three gates in series
Auto-reply requires **(topic allowlisted) AND (confidence high) AND (retrieval strong)** — and, optionally,
business hours. Each gate narrows the blast radius; anything short of all of them **drafts for a human**, and a
refusal always **hands off**. The safe branch at every decision is "let a human handle it," never "act anyway."
🔗 The S13 least-privilege stance, now the autonomy design.

### 3. Ship the trust ladder, not just the top rung (the debate)

**Auto-reply default: on for high-confidence, or off until an admin opts in?**
- **On:** immediate deflection value, but a wrong auto-answer erodes trust fast and the admin never chose it.
- **Off:** safe, slower adoption.

**Resolution: off by default; admins opt in per topic after reviewing the safety eval**, with intermediate
rungs — **draft-only** and **auto+CC-an-agent** — between off and full auto. *Autonomy is a trust ladder the
customer climbs deliberately; ship the rungs (off → draft → auto+CC → auto), not just the top.* Many teams live
on "auto+CC" for months, and the product should support that adoption curve.

### 4. Handoff carries context; assists are the low-risk entry point
- A **handoff** (on refusal / low confidence / user request) hands the human a summary + the citations + *what
  the bot tried* — the human inherits context, not a cold start. A handoff that drops context makes the
  customer repeat themselves.
- **Agent assists** (summarize a thread, draft a reply, adjust tone) are human-triggered and human-sent — the
  safe way to introduce AI. *Risk scales with autonomy, and so should eval rigor:* an assist barely needs a
  gate; auto-reply needs the strictest one.

## Consequences

- `packages/shared/autonomy.ts` (the gate, the ladder, handoff, assist prompts) is pure and unit-tested; the
  autonomy safety eval (`packages/eval/autonomy.test.ts`) scores the auto subset at zero-wrong before the gate
  opens. `AutonomySetting` (per-workspace) stores the ladder position; the bot route acts on the decision.
- Accessibility pass: status changes announced via polite live regions; the widget iframe carries an
  accessible label (real-time-a11y, 🔗 Tracer S14).
- **The enduring lesson:** *let AI act only where an eval proves it safe, scope it narrowly, and always leave a
  clean path back to a human.*
- **Links:** the S14 default-on-vs-off debate; ADR-0012 (the eval that sets the thresholds); ADR-0013 (the
  containment autonomy carefully relaxes).
