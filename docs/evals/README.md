# Evals

Baseline eval scores and datasets land here from **Sprint 9** onward.

Harbor's thesis: *an LLM feature without an eval is a demo, not a product.* From S9, every AI feature ships
with an eval dataset, graders, and a committed baseline score in this directory; the `eval:gate` CI check
fails a PR that regresses a baseline. Tests use the mock model + recorded fixtures (deterministic); live-model
runs are a separate, cost-capped nightly.
