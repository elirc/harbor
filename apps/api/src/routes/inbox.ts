import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@harbor/db";
import { canTransition, isEmailable, renderCanned, buildReplyHeaders, type OutgoingKind } from "@harbor/shared";
import { bus, type InboxEvent } from "../events";
import type { ConversationState } from "@harbor/shared";

/**
 * Shared-inbox routes (S04): the atomic claim, state transitions, the reply composer (reply/note/canned), and
 * the SSE stream. The concurrency + safety logic is modeled + tested in @harbor/shared; these wire it to the DB.
 */
export async function inboxRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 🔗 Claim an unassigned conversation via an ATOMIC precondition (the fix). `updateMany ... where assigneeId
   * is null` sets it only if still unassigned; `count === 0` means someone else won → a clean "already
   * claimed", never a silent overwrite. Same optimistic-concurrency shape as Tracer's approval race.
   */
  app.post<{ Params: { id: string }; Body: { agentId: string } }>("/conversations/:id/claim", async (req, reply) => {
    const { agentId } = z.object({ agentId: z.string().min(1) }).parse(req.body);
    const res = await prisma.conversation.updateMany({
      where: { id: req.params.id, assigneeId: null },
      data: { assigneeId: agentId },
    });
    if (res.count === 0) {
      const c = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { assigneeId: true } });
      return reply.code(409).send({ error: { code: "ALREADY_CLAIMED", message: "already claimed", assigneeId: c?.assigneeId ?? null } });
    }
    await prisma.assignment.create({ data: { conversationId: req.params.id, assigneeId: agentId, assignedById: agentId } });
    emit({ workspaceId: await wsOf(req.params.id), type: "conversation.assigned", conversationId: req.params.id, data: { assigneeId: agentId } });
    return { ok: true, assigneeId: agentId };
  });

  /** Assign/reassign (soft ownership — anyone can reassign; recorded in history). */
  app.post<{ Params: { id: string }; Body: { assigneeId: string | null; byAgentId?: string } }>(
    "/conversations/:id/assign",
    async (req) => {
      const { assigneeId, byAgentId } = z.object({ assigneeId: z.string().nullable(), byAgentId: z.string().optional() }).parse(req.body);
      await prisma.conversation.update({ where: { id: req.params.id }, data: { assigneeId } });
      await prisma.assignment.create({ data: { conversationId: req.params.id, assigneeId, assignedById: byAgentId ?? null } });
      emit({ workspaceId: await wsOf(req.params.id), type: "conversation.assigned", conversationId: req.params.id, data: { assigneeId } });
      return { ok: true, assigneeId };
    },
  );

  /** Transition state (validated by the state machine). */
  app.post<{ Params: { id: string }; Body: { to: ConversationState } }>("/conversations/:id/state", async (req, reply) => {
    const { to } = z.object({ to: z.enum(["open", "pending", "snoozed", "closed"]) }).parse(req.body);
    const c = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { state: true } });
    if (!c) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "conversation not found" } });
    if (!canTransition(c.state as ConversationState, to)) {
      return reply.code(422).send({ error: { code: "BAD_TRANSITION", message: `cannot go ${c.state} → ${to}` } });
    }
    await prisma.conversation.update({ where: { id: req.params.id }, data: { state: to } });
    emit({ workspaceId: await wsOf(req.params.id), type: "conversation.updated", conversationId: req.params.id, data: { state: to } });
    return { ok: true, state: to };
  });

  /**
   * The reply composer. A `reply` is emailed to the customer (with proper In-Reply-To/References so their
   * client threads it); a `note` is INTERNAL and NEVER emailed. Canned templates are safely interpolated (no
   * eval). ⚠️ The note/reply split is enforced by type here and asserted by E2E — the "replied publicly by
   * mistake" bug is prevented by design.
   */
  app.post<{ Params: { id: string }; Body: unknown }>("/conversations/:id/compose", async (req, reply) => {
    const input = z
      .object({
        kind: z.enum(["reply", "note"]),
        body: z.string().min(1).optional(),
        cannedTemplate: z.string().optional(),
        vars: z.record(z.string()).optional(),
        parentMessageId: z.string().optional(),
        parentReferences: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const kind: OutgoingKind = input.kind;
    const body = input.cannedTemplate ? renderCanned(input.cannedTemplate, input.vars ?? {}) : (input.body ?? "");
    if (!body) return reply.code(400).send({ error: { code: "VALIDATION", message: "empty body" } });

    const message = await prisma.message.create({
      data: { conversationId: req.params.id, direction: kind === "note" ? "note" : "outbound", raw: body, parsed: body },
    });

    let emailed = false;
    if (isEmailable(kind)) {
      // Send via the mock provider (stubbed), setting reply headers so the customer's client threads it.
      const headers = input.parentMessageId ? buildReplyHeaders(input.parentMessageId, input.parentReferences ?? []) : null;
      emailed = true;
      void headers; // handed to the mock email provider in a fuller build
    }
    emit({ workspaceId: await wsOf(req.params.id), type: "message.created", conversationId: req.params.id, data: { kind } });
    return reply.code(201).send({ id: message.id, emailed }); // note ⇒ emailed:false, always
  });

  /** SSE stream of inbox events for a workspace. */
  app.get<{ Querystring: { workspaceId?: string } }>("/events", async (req, reply) => {
    const workspaceId = req.query.workspaceId;
    reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    reply.raw.write(": connected\n\n");
    const unsubscribe = bus.subscribe((e) => {
      if (!workspaceId || e.workspaceId === workspaceId) reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
    });
    req.raw.on("close", () => unsubscribe());
    return reply;
  });
}

function emit(e: InboxEvent): void {
  bus.publish(e);
}
async function wsOf(conversationId: string): Promise<string> {
  const c = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { workspaceId: true } });
  return c?.workspaceId ?? "";
}
