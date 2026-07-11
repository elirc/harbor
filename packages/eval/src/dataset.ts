/**
 * Dataset loading (S09). Datasets are version-controlled JSON — DATA, not code — validated at the boundary so a
 * malformed case is caught at load, not mid-run. They grow like the S03 email corpus: every production surprise
 * becomes a new case, and the dataset is the institutional memory of "things the AI must get right."
 */
import { z } from "zod";
import type { EvalDataset } from "./types";

const EvalCaseSchema = z.object({
  id: z.string().min(1),
  input: z.string(),
  expected: z.string().optional(),
  rubric: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const EvalDatasetSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional(),
  cases: z.array(EvalCaseSchema).min(1),
});

/** Parse + validate a dataset (from `JSON.parse` of a docs/evals/*.json file). Throws on a malformed shape. */
export function parseDataset(raw: unknown): EvalDataset {
  const d = EvalDatasetSchema.parse(raw);
  return { name: d.name, cases: d.cases };
}
