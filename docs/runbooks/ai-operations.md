# Runbooks — AI Operations

Operator playbooks for Harbor's AI-in-the-loop failure modes. Each: **symptom → diagnosis → action → verify.**

## 1. LLM provider outage (Claude API down)

- **Symptom:** `GET /health/ai` returns `degraded_human_only`; bot-draft calls error/timeout; admin banner shows.
- **Diagnosis:** provider health probe failing; check status.anthropic.com; check `LLMCall` write rate dropped.
- **Action:** the bot auto-disables (aiAvailability → human-only) — no action needed to stay safe. Confirm
  conversations are routing to human agents (the S04 inbox is unaffected). Post an internal notice.
- **Verify:** new conversations land in the inbox assigned/queued; no bot_reply AIActions created during the
  window; when the provider recovers, `/health/ai` returns `on` and drafts resume.

## 2. Cost spike / budget cap hit

- **Symptom:** `/obs/llm` shows `budgetState: alert|capped`; $/day jumped; a purpose dominates `costByPurpose`.
- **Diagnosis:** which feature? (`costByPurpose`). A loop? An abusive contact (check `ContactCostLedger`)? A
  prompt-bloat regression (p95 token count up)?
- **Action:** capped ⇒ AI is already human-only for that workspace (graceful). Identify the driver; if abuse,
  the per-contact ceiling already bounded it; if a prompt regression, roll back the prompt; raise the budget
  only after understanding the driver.
- **Verify:** $/day returns to baseline; `budgetState: ok`; the driving purpose's per-call cost normalizes.

## 3. Quality / drift regression (groundedness drop, refusal spike)

- **Symptom:** drift alert pages on-call: groundedness down or refusal rate up (from production sampling).
- **Diagnosis:** a refusal spike usually means **retrieval broke**, not the model. Check: embedding index
  healthy? recent article deletions/re-chunk? embedding-model change without re-embed? Run the bot eval against
  the current index.
- **Action:** if the index is stale/broken, rebuild it (§4). If a prompt/model change regressed quality, roll
  back. Add the failing production cases to the eval dataset (they become permanent regression tests).
- **Verify:** re-run the bot eval → groundedness back at baseline; refusal rate normalizes; drift alert clears.

## 4. Retrieval index rebuild / re-embed

- **When:** index corruption, an embedding-model change, or a drift alert pointing at retrieval.
- **Action:** run the re-embed migration (S10 worker): `chunksToReEmbed(currentModel)` → batches → re-embed →
  write vectors. 🔗 Embeddings are DERIVED data — never restore old vectors against a new model.
- **Verify:** `retrieveRelevant` returns relevant chunks for known queries; the chunker showdown / bot eval pass.

## 5. Backup & restore

- **Backup:** conversations, articles, contacts, and `ArticleChunk` text + metadata. **Embeddings are derived**
  — back up the text, not (only) the vectors.
- **Restore:** restore rows, then **re-embed** (§4) rather than trusting restored vectors, because the embedding
  model may have moved. Verify with the bot eval on staging before cutover.

## 6. Rollback

- **Prompt/model rollback:** revert the prompt or model-selection change; the eval baseline tells you if it
  helped. **Never** roll back without re-running the eval — "it feels better" isn't a signal here.
