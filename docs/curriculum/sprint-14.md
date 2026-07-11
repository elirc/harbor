# Curriculum Note — Sprint 14: Bot Autonomy, Handoff & Polish

> **Let AI act only where an eval proves it safe, scope it narrowly, and always leave a clean path back to a
> human.** Autonomy is the culmination of the eval-first thesis — and the moment supervision (the security
> containment) is deliberately, carefully relaxed.

## Learning objectives
- Grant autonomy as an **eval decision**, not an optimism decision.
- Compose safety from **gates in series**, each narrowing the blast radius.
- Ship the **trust ladder**, matching the customer's adoption curve.
- Make **handoff** carry context, and understand why assists are the safe entry point.

## Key concepts
- **📘 Autonomy is earned by an eval.** The bot auto-replies only on a subset whose wrong-answer rate is
  near-zero in a *committed* eval score. A false answer in auto mode — where nobody reviews it — is the worst
  outcome in the whole product, so the bar is the highest here. "Confident enough to act" is a measured
  threshold; the numbers come from S12's eval, not a slide deck. This is what the entire eval-first arc (S09 →
  now) was building toward: the ability to *safely* let the model act because you can *prove* where it's safe.
- **🔍 Three gates in series.** Auto-reply requires (topic allowlisted) AND (confidence high) AND (retrieval
  strong). Each gate is a separate narrowing of the blast radius, and *all* must pass; any failure drafts for a
  human, a refusal hands off. Compose safety from independent constraints — one strong gate is more fragile than
  three narrow ones. 🔗 The S13 least-privilege stance, applied to autonomy.
- **📘 Ship the whole trust ladder.** Off → draft → auto+CC → auto. Most teams don't jump to full auto; they
  climb — living on "auto-reply but CC an agent" while they build trust. A product that only offers on/off
  ignores the adoption curve; ship the rungs. Safe default: **off**.
- **📘 Supervision was a security control — relaxing it has a cost.** In S13, "a human sends it" was what made a
  successful prompt injection harmless. Auto-reply removes that human, so the injection containment weakens —
  which is *why* auto is gated so tightly (narrow allowlist + high confidence + strong retrieval + eval proof).
  Autonomy and security are the same conversation.
- **📘 A handoff that drops context is a bad handoff.** On refusal / low confidence / user request, the human
  inherits a summary + citations + *what the bot tried* — not a cold start where the customer repeats
  themselves. The bot's transparency is the entire value of the handoff.
- **📘 Risk scales with autonomy, so eval rigor should too.** Human-triggered, human-sent assists (summarize,
  draft, adjust tone) are the low-risk entry point — barely a gate. Auto-reply is the high-risk end — the
  strictest gate + a committed safety eval. Match the guardrail to the blast radius.

## The debate, cashed
**Auto-reply default: on for high-confidence, or off until admin opt-in?** Resolved: **off by default; opt in
per topic after reviewing the safety eval**, with draft-only and auto+CC as intermediate rungs. *Autonomy is a
trust ladder the customer climbs deliberately.* (ADR-0014.)

## Exercise questions
1. Auto-reply needs three gates ALL to pass. Construct a case that clears two but not the third, and explain why
   drafting (not auto-sending) is the right call there.
2. Why is "off by default, opt in per topic" safer than "on for anything above 0.9 confidence"? Whose decision
   is autonomy, and why does that matter?
3. S13 made prompt injection harmless because a human sends every reply. Auto-reply removes that human. What
   *specifically* re-contains injection risk in the auto path, and where is it weakest?
4. Design the handoff note. What three things must it carry so the human doesn't make the customer repeat
   themselves?
5. Rank by required eval rigor: tone-adjust assist, draft-for-human, auto+CC reply, full auto reply. Justify the
   ordering by blast radius.

## Further reading
- Human-in-the-loop / graduated autonomy · capability gating & confidence calibration · real-time a11y (ARIA
  live regions) · ADR-0014, ADR-0012, ADR-0013 · the autonomy safety eval.
