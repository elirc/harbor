# Writing Evals (the learner's job from S09 on)

From Sprint 9, **you curate the eval cases.** Writing good test cases for AI behavior is a taught-by-doing
skill, and it's now yours. This guide is the how.

## The shape of a dataset

A dataset is version-controlled JSON in this directory (`docs/evals/*.dataset.json`). Each case:

```json
{ "id": "billing-refund", "input": "I want a refund", "expected": "billing", "rubric": ["refund", "billing"], "tags": ["billing"] }
```

- **`id`** — stable, human-readable. Never renumber; the id is how a case is tracked across baselines.
- **`input`** — what the target (classifier, RAG, bot) receives.
- **`expected`** — for exact/contains graders (a label, a value).
- **`rubric`** — for the LLM-as-judge: the criteria a good answer must satisfy. One idea per entry.
- **`tags`** — slice your scores (by channel, by difficulty, by topic).

## Choosing a grader

Pick the **cheapest grader that captures the property you care about**:

| You care about… | Use |
|---|---|
| An exact label or value | `exactMatch()` |
| A required word/phrase is present | `contains()` / `regexGrader()` |
| The output is well-formed (valid JSON, has keys) | `jsonShape([...])` |
| Open-ended answer quality | `makeLlmJudge(provider, { mode: "rubric" })` |

Reach for the judge **last** — it's the most expensive and the least trustworthy. If a regex can check "did it
cite a source," use the regex.

## The rules that keep evals honest

1. **Grow the dataset from production surprises.** Every time the AI gets something wrong in real life, add the
   case. The dataset is your institutional memory (🔗 the S03 email corpus, again).
2. **Include the hard and the ambiguous.** A dataset of only easy cases reports a great score and teaches you
   nothing. Add the genuinely ambiguous inputs (`"hi, quick question"`) — sometimes the right answer is "ask a
   clarifying question," and your grader should say so.
3. **Prefer rubric-decomposed judging over holistic scores.** "Rate 0–10" invites the judge's length/position
   biases; "does the answer satisfy each of these specific criteria?" resists them. See the meta-eval.
4. **Grade your grader.** Before trusting a new judge, run it against a handful of *gold-labeled* pairs where
   you already know which answer is better. If the judge disagrees with the gold label, the judge is the bug.
5. **Watch cost, not just score.** A prompt change that lifts the score 1pt and triples $/case is a tradeoff to
   discuss, not a win to merge.

## Baselines & the gate

A baseline is a frozen `{ meanScore, passRate, costPerCaseUsd }` committed alongside the dataset. The CI gate
fails a PR whose score drops beyond tolerance (default 2pts) or whose cost/case jumps beyond tolerance (default
25%). A score *improvement* never fails — it's the signal to re-freeze the baseline higher.

## Determinism

CI never calls a live model. It replays recorded fixtures (keyed by prompt hash) through the mock provider. To
refresh fixtures, run the nightly live job (cost-capped) and commit the new recording. A replay **miss** is
loud on purpose — it means the prompt or dataset changed and the fixtures need re-recording.
