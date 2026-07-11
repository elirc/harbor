/**
 * `@harbor/eval` (S09) — the evaluation harness, built BEFORE any AI feature. Datasets, graders (exact /
 * heuristic / LLM-as-judge), a target-agnostic runner, cost/latency reporting, deterministic replay, and a CI
 * regression gate. The thesis of the whole back half of the course: *an LLM feature without an eval is a demo,
 * not a product.*
 */
export * from "./types";
export * from "./dataset";
export * from "./runner";
export * from "./regression";
export * from "./report";
