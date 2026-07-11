#!/usr/bin/env bash
# Harbor — one-time GitHub setup: labels + milestones (+ enable Discussions).
# Prereqs: `gh auth login` done, and you are inside the harbor repo with an `origin` remote.
# Usage:   bash scripts/setup-github.sh
# Safe to re-run: labels use --force; milestone creation tolerates duplicates.

set -uo pipefail

echo "==> Repo: $(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '??? (run inside the repo, after gh auth login)')"

label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null 2>&1 && echo "  label: $1"; }

echo "==> Creating labels"
for n in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do
  label "sprint-$n" "ededed" "Sprint $n"
done
label "phase-mvp"  "0e8a16" "Phase 1 — MVP (S01–S05)"
label "phase-full" "1d76db" "Phase 2 — full product (S06–S15)"
# Teaching topics (Harbor — support platform + LLM done right)
label "teaching:email"    "1d76db" "MIME parsing, threading, reply/signature stripping"
label "teaching:identity" "5319e7" "Contact identity resolution & merge"
label "teaching:realtime" "5319e7" "Shared inbox, SSE, presence"
label "teaching:widget"   "1d76db" "Embeddable iframe messenger, postMessage bridge"
label "teaching:routing"  "fbca04" "Assignment, SLAs, escalation"
label "teaching:llm"      "5319e7" "Claude API, structured outputs, streaming"
label "teaching:eval"     "0e8a16" "Eval harness, datasets, graders, regression gates"
label "teaching:rag"      "5319e7" "Chunking, retrieval, grounding"
label "teaching:security" "b60205" "Prompt injection, PII, abuse, origin checks"
label "teaching:cost"     "fbca04" "LLM cost/latency governance"
# Process
label "learner-authored" "0e8a16" "[L]/[J] substantially written by the learner; AI reviews"
label "planted-debate"   "d93f0b" "A deliberate design debate thread lives on this PR"
label "deferred"         "c5def5" "Deferred work, filed as a linked issue"
label "lab"              "fef2c0" "Post-sprint practice branch/exercise"
label "adr"              "bfd4f2" "Introduces or changes an ADR"
label "good-first-read"  "7057ff" "A good PR for the learner to study first"

echo "==> Creating milestones (one per sprint)"
milestone() {
  gh api "repos/{owner}/{repo}/milestones" -f title="$1" -f state=open >/dev/null 2>&1 \
    && echo "  milestone: $1" || echo "  milestone exists/skip: $1"
}
milestone "Sprint 01 — Foundation & walking skeleton (message → inbox)"
milestone "Sprint 02 — Workspaces, agents, contacts & identity"
milestone "Sprint 03 — Inbound email: MIME, threading, reply stripping"
milestone "Sprint 04 — Shared inbox: conversations, assignment, real-time"
milestone "Sprint 05 — Web messenger widget + help center"
milestone "Sprint 06 — Routing & assignment engine"
milestone "Sprint 07 — SLAs, escalation & reporting v1"
milestone "Sprint 08 — Knowledge base + help-center search"
milestone "Sprint 09 — The eval harness"
milestone "Sprint 10 — RAG: retrieval over help docs"
milestone "Sprint 11 — AI triage + structured outputs"
milestone "Sprint 12 — Answer-bot: guardrails, citations, cost"
milestone "Sprint 13 — Hardening: prompt injection, PII & abuse"
milestone "Sprint 14 — Bot autonomy, handoff & polish"
milestone "Sprint 15 — Production readiness (v1.0.0)"

echo "==> Enabling Discussions"
gh api -X PATCH "repos/{owner}/{repo}" -f has_discussions=true >/dev/null 2>&1 && echo "  discussions enabled" || echo "  discussions: skip"

echo "==> Done."
