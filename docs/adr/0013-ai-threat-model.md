# ADR-0013 — The AI threat model: contain injection architecturally

**Status:** accepted (S13) · **Deciders:** Harbor course

## Context

Harbor's AI features (triage, RAG answer-bot) introduce attack surfaces that don't exist in a CRUD app:
**prompt injection** (user text that rewrites your instructions), **cross-scope leakage** (a cached answer or a
retrieved chunk crossing a tenant boundary), **PII exfiltration** (every LLM call ships data to a third party),
and **cost abuse** (an attacker running up your model bill). This ADR records the stance for defending them.

## Decisions

### 1. Prompt-injection defense is layered, weighted toward architecture (the debate)

**Prompt-level (delimiting/instructions) vs a classifier guard vs architectural (least-privilege)?**
- **Prompt-level** (delimit untrusted content, label it as data): necessary, *insufficient* — injections evolve
  and a determined one gets through wording defenses.
- **Classifier guard** (flag known steering patterns): catches the obvious, but it's an arms race.
- **Architectural** (limit what a compromised prompt can *cause*): the model can only *suggest*, never *act*.

**Resolution: all three, weighted toward architectural.** The bot only *drafts* (a human sends); triage only
*suggests* (routing rules + humans decide). So even a *successful* injection is contained — it can make the
model say something wrong, but it cannot take an action, move money, or reroute a conversation on its own.
Delimiting + a lightweight classifier are defense-in-depth on top. *You can't fully prevent prompt injection;
design so that a successful one can't hurt you — least-privilege for the model is itself a security control.*

### 2. Cache keys and retrieval carry the authorization scope
An LLM answer cache keyed on the prompt hash alone is a cross-tenant leak with a performance win. The key
includes `workspace + scope`, so a cached answer never crosses a trust boundary. (Retrieval is already
workspace-scoped in SQL; the same discipline.)

### 3. PII is redacted before it leaves and before it's logged
Every model call is a data egress to a third party. `redactPII` masks emails/cards/SSNs/phones (keeping shape,
so the model still sees "an email was here") before the text enters a prompt or a log. Redact what the task
doesn't need.

### 4. Cost has a per-contact ceiling
`ContactCostLedger` bounds the blast radius of cost abuse: one contact can't spend the whole workspace's LLM
budget. Over the ceiling, the bot refuses.

### 5. The web trust boundary is verified, not assumed
The messenger bridge verifies `event.origin` against an allowlist and posts only to a specific origin — the
classic "trust the caller" postMessage bug, closed.

## Consequences

- `packages/shared/security.ts` (delimiting, classifier, redaction, cache scoping, cost ledger) is pure and
  tested; the injection suite (`packages/eval/injection.test.ts`) is a permanent CI gate.
- **Ledger closed:** flaws **#1** (threading, S03→S07→S13), **#2** (messenger origin), **#4** (prompt
  injection), and the cache-leak finding are all harvested. (flaw #3 closed in S12.)
- **The enduring lesson:** AI features have novel attack surfaces, and the strongest defense is architectural —
  *never let the model do more than suggest.* Autonomy (S14) must therefore be earned, gated, and reversible.
- **Links:** the S13 audit (`docs/audits/sprint-13-audit.md`); the injection debate; S11 (flaw #4 planted),
  S05 (flaw #2), S03/S07 (flaw #1); the prompt-injection lab.
