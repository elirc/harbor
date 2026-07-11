/**
 * The eval harness (S09) — the course's crown jewel, and its most counter-cultural move: build the way to
 * MEASURE AI quality BEFORE building any AI feature. When triage (S11), RAG (S10), and the answer-bot (S12)
 * arrive, they are measurable from commit one.
 *
 * 📘 The thesis, in one line: *you cannot improve what you cannot measure, and "it looked good in the demo" is
 * measurement theater.* Every AI change from here on gets a number.
 */

/** One evaluation case: an input, an expectation (exact/rubric), and tags. Cases are version-controlled DATA. */
export interface EvalCase {
  id: string;
  input: string;
  /** For exact/contains graders. */
  expected?: string;
  /** For the LLM-as-judge: the criteria a good answer must cover. */
  rubric?: string[];
  tags?: string[];
}

export interface EvalDataset {
  name: string;
  cases: EvalCase[];
}

/** A grader's verdict on one output: a 0..1 score and a pass/fail against the grader's own threshold. */
export interface GradeResult {
  score: number; // 0..1
  pass: boolean;
  detail?: string;
}

/** A grader scores one output against its case. May call a model (LLM-judge) — hence possibly async. */
export type Grader = (output: string, c: EvalCase) => GradeResult | Promise<GradeResult>;

/** What the harness runs a case against. Returns the output plus optional cost/latency (from the LLM client). */
export type Target = (input: string) => Promise<TargetResult>;
export interface TargetResult {
  output: string;
  costUsd?: number;
  latencyMs?: number;
}

export interface CaseResult {
  caseId: string;
  output: string;
  scores: Record<string, GradeResult>;
  /** Mean of the graders' scores for this case. */
  aggregate: number;
  costUsd: number;
  latencyMs: number;
}

export interface RunSummary {
  dataset: string;
  cases: CaseResult[];
  meanScore: number;
  passRate: number;
  totalCostUsd: number;
  costPerCaseUsd: number;
  p95LatencyMs: number;
}
