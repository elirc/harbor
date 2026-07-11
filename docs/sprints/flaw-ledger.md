# Harbor Flaw Ledger (author-private until Sprint 13 recap)

| # | Planted in | What | Where | Harvested in | Status |
|---|-----------|------|-------|--------------|--------|
| 1 | S03 | Email threading keys only on `Subject` similarity — "Re: Re: Fwd:" chains and shared subjects merge unrelated conversations | mailin threader | S07/S13 (threading via References/In-Reply-To headers; cross-contact merge test) | planned |
| 2 | S05 | Messenger widget trusts postMessage without origin check — any page can drive the widget | messenger host bridge | S13 (origin allowlist; message-forgery probe) | planned |
| 3 | S10 | Fixed-size chunking splits mid-sentence, and retrieval has no score threshold (always returns top-k even when irrelevant) | rag chunker/retriever | S12 (relevance threshold → refusal) + eval evidence | planned |
| 4 | S11 | Triage prompt concatenates raw user message into instructions (no delimiting/defense) — prompt injection steers routing | triage prompt build | S13 (injection eval suite; delimiting + structured extraction) | planned |
| 5 | S12 | LLM responses cached by prompt hash with no PII/permission scoping — one contact's cached answer could serve another | llm cache key | S13 (scope cache by workspace+permission; leak test) | planned |

**In-PR arcs (planted and fixed inside one PR by design):**
S02 contact merge race (echo of Pulse S6) → advisory lock · S04 assignment double-claim (two agents grab one conversation) → optimistic status precondition · S09 grader that rewards verbosity → the eval's own bug, caught by a meta-test · S11 schema-invalid tool output crashes the handler → validation + retry/fallback.

**Rules:** never fix a ledger flaw silently; harvesting commits quote the ledger row and flip Status.
