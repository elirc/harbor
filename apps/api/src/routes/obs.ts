import type { FastifyInstance } from "fastify";
import { prisma } from "@harbor/db";
import { costByPurpose, totalCostUsd, p95LatencyMs, refusalRate, budgetState, aiAvailability, type LlmSpan, type Budget } from "@harbor/shared";

/**
 * Observability + AI health (S15). The S01 LLMCall ledger finally pays off: cost/latency/quality dashboards
 * from real spans, and an AI-health endpoint that says whether the bot is on or degraded to human-only. AI is
 * an enhancement over the S04 human inbox — when it's down or over budget, we degrade cleanly, never crash.
 */

// Demo budget; per-workspace budgets live on a settings row in a fuller build.
const BUDGET: Budget = { softAlertUsd: 20, hardCapUsd: 50 };

export async function obsRoutes(app: FastifyInstance): Promise<void> {
  /** LLM dashboards: $/day by feature, p95 latency, token trend — grouped from the cost ledger. */
  app.get<{ Querystring: { workspaceId?: string } }>("/obs/llm", async (req) => {
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.lLMCall.findMany({ where: { workspaceId, at: { gte: since } } });
    const spans: LlmSpan[] = rows.map((r) => ({ purpose: r.purpose, costUsd: r.costUsd, latencyMs: r.latencyMs, inputTokens: r.inputTokens, outputTokens: r.outputTokens }));

    const botActions = await prisma.aIAction.findMany({ where: { type: { in: ["bot_draft", "bot_reply"] } }, select: { payload: true } });
    const refusals = botActions.map((a) => ({ refused: Boolean((a.payload as { refused?: boolean } | null)?.refused) }));

    const spend = totalCostUsd(spans);
    return {
      window: "24h",
      totalCostUsd: spend,
      costByPurpose: costByPurpose(spans),
      p95LatencyMs: p95LatencyMs(spans),
      refusalRate: refusalRate(refusals),
      budgetState: budgetState(spend, BUDGET),
    };
  });

  /**
   * AI health: is the bot on, or degraded to human-only? Degrades on provider outage or a capped budget. The
   * SPA shows an admin banner; the bot route consults the same signal before spending on a model call.
   */
  app.get<{ Querystring: { workspaceId?: string } }>("/health/ai", async (req) => {
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const spent = (await prisma.lLMCall.aggregate({ where: { workspaceId, at: { gte: since } }, _sum: { costUsd: true } }))._sum.costUsd ?? 0;
    const providerUp = process.env.LLM_PROVIDER_DOWN !== "1"; // a real probe pings the provider health endpoint
    return aiAvailability(providerUp, budgetState(spent, BUDGET));
  });
}
