/**
 * `@harbor/rag` (S08) — the knowledge preprocessing RAG stands on: document normalization + chunking. No model
 * yet. Embeddings and retrieval (with pgvector) arrive in S10; the eval that finally grades these chunking
 * choices arrives in S09. This package is pure and snapshot-tested.
 */
export * from "./normalize";
export * from "./chunk";
