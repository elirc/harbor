import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Prisma } from "@harbor/db";
import {
  RoutingRuleInputSchema,
  route as routeDecision,
  roundRobin,
  type Condition,
  type Action,
  type RoutingContext,
  type RoutingRule,
} from "@harbor/shared";
import { bus } from "../events";

/**
 * Routing engine routes (S06). Rule CRUD, a PREVIEW/dry-run (the debuggability star), and `apply` — evaluate
 * rules for a conversation, assign the team, then pick an agent within it fairly and atomically. The rule
 * semantics + strategies are pure and tested in @harbor/shared; these wire them to the DB.
 */
const ContextSchema = z.object({
  channel: z.enum(["email", "messenger", "api"]),
  subject: z.string().default(""),
  bodyText: z.string().default(""),
  contactAttrs: z.record(z.string()).default({}),
});

/** Read persisted rules and shape them for the pure evaluator. */
async function loadRules(workspaceId: string): Promise<RoutingRule[]> {
  const rows = await prisma.routingRule.findMany({ where: { workspaceId }, orderBy: { order: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    enabled: r.enabled,
    condition: r.condition as unknown as Condition,
    actions: r.actions as unknown as Action[],
  }));
}

export async function routingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { workspaceId?: string } }>("/routing/rules", async (req) => {
    return prisma.routingRule.findMany({ where: { workspaceId: req.query.workspaceId ?? "demo-ws" }, orderBy: { order: "asc" } });
  });

  app.post<{ Body: unknown }>("/routing/rules", async (req, reply) => {
    const body = z.object({ workspaceId: z.string().default("demo-ws") }).passthrough().parse(req.body);
    const input = RoutingRuleInputSchema.parse(body); // validates the AST shape at the boundary
    const rule = await prisma.routingRule.create({
      data: {
        workspaceId: body.workspaceId,
        name: input.name,
        order: input.order,
        enabled: input.enabled,
        condition: input.condition as unknown as Prisma.InputJsonValue,
        actions: input.actions as unknown as Prisma.InputJsonValue,
      },
    });
    return reply.code(201).send(rule);
  });

  app.put<{ Params: { id: string }; Body: unknown }>("/routing/rules/:id", async (req, reply) => {
    const input = RoutingRuleInputSchema.partial().parse(req.body);
    const rule = await prisma.routingRule
      .update({
        where: { id: req.params.id },
        data: {
          name: input.name,
          order: input.order,
          enabled: input.enabled,
          condition: input.condition ? (input.condition as unknown as Prisma.InputJsonValue) : undefined,
          actions: input.actions ? (input.actions as unknown as Prisma.InputJsonValue) : undefined,
        },
      })
      .catch(() => null);
    if (!rule) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such rule" } });
    return rule;
  });

  /**
   * 🔍 PREVIEW / dry-run — "which rule fires for this conversation, and why." Returns the full trace (every
   * enabled rule in order + matched?), so an admin can see exactly why routing did what it did. Built before
   * the rules get complex, on purpose: a rule engine without this generates unanswerable support tickets.
   */
  app.post<{ Body: unknown }>("/routing/preview", async (req) => {
    const body = z.object({ workspaceId: z.string().default("demo-ws"), context: ContextSchema }).parse(req.body);
    const rules = await loadRules(body.workspaceId);
    return routeDecision(rules, body.context as RoutingContext);
  });

  /** Apply routing to a real conversation: evaluate → set team/priority → pick an agent fairly + atomically. */
  app.post<{ Params: { id: string } }>("/conversations/:id/route", async (req, reply) => {
    const convo = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { contact: { include: { identities: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!convo) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such conversation" } });

    // Derive the routing context. Channel is inferred from the contact's identities (messenger id ⇒ messenger).
    const channel: RoutingContext["channel"] = convo.contact.identities.some((i) => i.type === "messenger") ? "messenger" : "email";
    const ctx: RoutingContext = { channel, subject: convo.subject, bodyText: convo.messages[0]?.parsed ?? "", contactAttrs: {} };

    const rules = await loadRules(convo.workspaceId);
    const decision = routeDecision(rules, ctx);

    let teamId: string | null = null;
    let priority: string | null = null;
    let directAgent: string | null = null;
    for (const a of decision.actions) {
      if (a.type === "assignTeam") teamId = a.teamId;
      if (a.type === "setPriority") priority = a.priority;
      if (a.type === "assignAgent") directAgent = a.agentId;
    }

    const assigneeId = directAgent ?? (teamId ? await pickAgentForTeam(convo.workspaceId, teamId) : null);
    await prisma.conversation.update({
      where: { id: convo.id },
      data: { assignedTeamId: teamId ?? undefined, priority: priority ?? undefined, assigneeId: assigneeId ?? undefined },
    });
    if (assigneeId) await prisma.assignment.create({ data: { conversationId: convo.id, assigneeId, assignedById: null } });
    bus.publish({ workspaceId: convo.workspaceId, type: "conversation.assigned", conversationId: convo.id, data: { teamId, assigneeId, priority, matchedRuleId: decision.matchedRuleId } });
    return { matchedRuleId: decision.matchedRuleId, teamId, priority, assigneeId, trace: decision.trace };
  });
}

/**
 * Pick an agent within a team fairly. ⚠️ "fewest open" is a check-then-act race, and round-robin's cursor is a
 * counter race — both pile conversations on one agent under concurrency. We serialize picks per team with a
 * Postgres advisory lock (🔗 the S02 pattern) so the whole choose-and-commit is atomic. Load-aware first,
 * round-robin as the tiebreaker/fallback via an atomically-incremented cursor.
 */
async function pickAgentForTeam(workspaceId: string, teamId: string): Promise<string | null> {
  const lockKey = `route|${workspaceId}|${teamId}`;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const agents = await tx.agent.findMany({ where: { workspaceId, teamId }, select: { id: true } });
    if (agents.length === 0) return null;
    const ids = agents.map((a) => a.id);

    // Load-aware: fewest OPEN conversations wins. Counting under the lock makes choose-and-commit atomic.
    const loads = await tx.conversation.groupBy({ by: ["assigneeId"], where: { workspaceId, state: "open", assigneeId: { in: ids } }, _count: true });
    const loadOf = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const l of loads) if (l.assigneeId) loadOf.set(l.assigneeId, l._count);
    const minLoad = Math.min(...ids.map((id) => loadOf.get(id) ?? 0));
    const leastLoaded = ids.filter((id) => (loadOf.get(id) ?? 0) === minLoad);

    if (leastLoaded.length === 1) return leastLoaded[0];
    // Tie → round-robin over the tied set via the persisted, atomically-incremented cursor.
    const cursorRow = await tx.teamCursor.upsert({
      where: { workspaceId_teamId: { workspaceId, teamId } },
      create: { workspaceId, teamId, cursor: 0 },
      update: { cursor: { increment: 1 } },
    });
    return roundRobin(leastLoaded, cursorRow.cursor).agentId;
  });
}
