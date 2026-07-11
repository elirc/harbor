/**
 * Background worker (S01) — a placeholder for now. Harbor's async jobs (SLA timers, escalation, email
 * send/retry, RAG indexing, nightly evals) arrive from S06 onward (BullMQ + Redis). It exists from day one so
 * the deploy topology (api + worker + web) is real from the start.
 */
export function describeWorker(): string {
  return "harbor worker — jobs arrive S06+ (SLA timers, escalation, indexing, nightly evals)";
}

if (process.env.NODE_ENV !== "test") {
  console.log(describeWorker());
}
