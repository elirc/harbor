# ADR-0002 — pgvector for RAG (planned, added when RAG arrives)

**Status:** accepted-as-plan (S01) · **Deciders:** Harbor course

## Context

Harbor's answer-bot (S12) retrieves over help-center articles (RAG, S10). That needs vector similarity
search. We record the plan now so the DB choice isn't a surprise later — but we do **not** add the extension
or embedding columns until S10, because carrying unused infrastructure is its own cost.

## Decision

When RAG arrives (S10), use **pgvector** in the existing PostgreSQL — an `ArticleChunk` table with an
`embedding vector` column and an ANN index — rather than a separate vector database.

- **One datastore:** articles, chunks, and their embeddings live beside the rest of the domain; no second
  system to operate, back up, or keep consistent. Support-scale corpora (a company's help center) fit
  comfortably.
- **Added at S10, not now:** the S01 dev DB is plain Postgres; S10 swaps the image to `pgvector/pgvector` and
  adds the extension + column via a migration. Naming and models are designed so that's additive.

## Alternatives considered

- **A dedicated vector DB (Pinecone/Weaviate/Qdrant).** Deferred/rejected for Harbor's scale: a second system
  to run and sync for a corpus that fits in Postgres. **Revisit trigger:** if retrieval latency or corpus
  size outgrows pgvector's ANN performance at Harbor's scale.
- **Add pgvector now.** Rejected: unused infrastructure. We add it the sprint it's needed.

## Consequences

- The S01 schema is plain Postgres; the RAG models (`Article`, `ArticleChunk` + embeddings) land in S10 as an
  additive migration.
- **Links:** ADR-0001 (the LLM abstraction this RAG layer will call through).
