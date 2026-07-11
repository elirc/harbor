import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@harbor/db";
import { percentiles, countBy, slaStatus, type SlaWindow } from "@harbor/shared";
import type { BusinessHours } from "@harbor/shared";

/**
 * Reporting v1 + SLA status (S07). The aggregate queries use the shared statistics (percentiles, not averages)
 * and the shared SLA clock. Kept thin: the math is pure and tested in @harbor/shared.
 */

// A default 9–5 Mon–Fri UTC calendar for demo SLA math; real workspaces carry their own.
const DEFAULT_HOURS: BusinessHours = {
  utcOffsetMinutes: 0,
  windows: { 1: { openMin: 540, closeMin: 1020 }, 2: { openMin: 540, closeMin: 1020 }, 3: { openMin: 540, closeMin: 1020 }, 4: { openMin: 540, closeMin: 1020 }, 5: { openMin: 540, closeMin: 1020 } },
};

export async function reportingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 📘 Reporting v1: volume, first-response percentiles, and per-agent workload. First-response time is the
   * wall-clock gap between a conversation's creation and its first OUTBOUND message. We report p50/p90/p95 —
   * the average would bury the angry tail.
   */
  app.get<{ Querystring: { workspaceId?: string } }>("/reports/overview", async (req) => {
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    const convos = await prisma.conversation.findMany({
      where: { workspaceId },
      select: { id: true, createdAt: true, assigneeId: true, state: true, messages: { where: { direction: "outbound" }, orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } } },
    });

    const firstResponseMins: number[] = [];
    for (const c of convos) {
      const firstOut = c.messages[0];
      if (firstOut) firstResponseMins.push((firstOut.createdAt.getTime() - c.createdAt.getTime()) / 60_000);
    }

    const workload = countBy(convos.filter((c) => c.state === "open" && c.assigneeId), (c) => c.assigneeId as string);
    return {
      volume: convos.length,
      firstResponseMinutes: percentiles(firstResponseMins),
      workload,
    };
  });

  /** Live SLA status for a conversation's windows (remaining business-time, at-risk, breached). */
  app.get<{ Params: { id: string } }>("/conversations/:id/sla", async (req) => {
    const windows = await prisma.sLAWindow.findMany({ where: { conversationId: req.params.id } });
    const now = new Date();
    return windows.map((w) => {
      const win: SlaWindow = {
        targetMs: w.targetMs,
        startedAt: w.startedAt,
        pauses: (w.pauses as Array<{ from: string; to: string | null }>).map((p) => ({ from: new Date(p.from), to: p.to ? new Date(p.to) : null })),
      };
      return { kind: w.kind, ...slaStatus(win, now, DEFAULT_HOURS) };
    });
  });

  /** Open (start) an SLA window on a conversation — e.g. a first-response clock when it's created. */
  app.post<{ Params: { id: string }; Body: unknown }>("/conversations/:id/sla", async (req, reply) => {
    const { kind, targetMs } = z.object({ kind: z.enum(["first_response", "resolution"]).default("first_response"), targetMs: z.number().int().positive() }).parse(req.body);
    const w = await prisma.sLAWindow.create({ data: { conversationId: req.params.id, kind, targetMs } });
    return reply.code(201).send(w);
  });
}
