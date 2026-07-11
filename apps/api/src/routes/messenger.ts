import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@harbor/db";
import { bus } from "../events";

/**
 * The messenger channel (S05): widget sessions become conversations. A session starts ANONYMOUS — we resolve
 * (or create) a Contact keyed on a `messenger` identity whose value is the session id, and hang a Conversation
 * off it. When the host calls `identify()`, we resolve the *real* contact (by external id) and fold the
 * session's conversation onto them.
 *
 * 🔗 Third appearance of anonymous→identified (Pulse SDK, Tracer offline, now the messenger) and it reuses the
 * exact S02 resolve-or-create machinery — the identity system built two sprints ago is why this is short.
 */
const StartSchema = z.object({ workspaceId: z.string().min(1), sessionId: z.string().min(1) });
const SendSchema = z.object({ body: z.string().min(1) });
const IdentifySchema = z.object({ externalId: z.string().min(1), email: z.string().optional(), name: z.string().optional() });

/** Resolve-or-create a contact for a (type,value) identity under an advisory lock — the S02 pattern. */
async function resolveContactId(workspaceId: string, type: "messenger" | "external" | "email", value: string, name?: string): Promise<string> {
  const lockKey = `${workspaceId}|${type}|${value}`;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const existing = await tx.identity.findUnique({
      where: { workspaceId_type_value: { workspaceId, type, value } },
      select: { contactId: true },
    });
    if (existing) return existing.contactId;
    const contact = await tx.contact.create({
      data: { workspaceId, name, identities: { create: { workspaceId, type, value } } },
    });
    return contact.id;
  });
}

export async function messengerRoutes(app: FastifyInstance): Promise<void> {
  /** Start (or resume) a widget session: anonymous contact + an open conversation. */
  app.post("/messenger/session", async (req) => {
    const { workspaceId, sessionId } = StartSchema.parse(req.body);
    const contactId = await resolveContactId(workspaceId, "messenger", sessionId);
    let convo = await prisma.conversation.findFirst({
      where: { workspaceId, contactId, state: { not: "closed" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    convo ??= await prisma.conversation.create({
      data: { workspaceId, contactId, subject: "Chat", state: "open" },
      select: { id: true },
    });
    return { sessionId, conversationId: convo.id, contactId };
  });

  /** A widget message → an inbound Message on the session's conversation, surfaced live to the agent inbox. */
  app.post<{ Params: { conversationId: string } }>("/messenger/:conversationId/messages", async (req, reply) => {
    const { body } = SendSchema.parse(req.body);
    const convo = await prisma.conversation.findUnique({ where: { id: req.params.conversationId }, select: { id: true, workspaceId: true } });
    if (!convo) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such conversation" } });
    const msg = await prisma.message.create({ data: { conversationId: convo.id, direction: "inbound", raw: body, parsed: body } });
    await prisma.conversation.update({ where: { id: convo.id }, data: { state: "open", updatedAt: new Date() } });
    bus.publish({ workspaceId: convo.workspaceId, type: "message.created", conversationId: convo.id, data: { channel: "messenger" } });
    return reply.code(201).send({ id: msg.id });
  });

  /**
   * Upgrade an anonymous session to an identified contact. Fold the anonymous conversation onto the real
   * contact so nothing said while anonymous is lost — the same reattach-then-delete merge as S02.
   */
  app.post<{ Params: { conversationId: string }; Body: unknown }>("/messenger/:conversationId/identify", async (req, reply) => {
    const { externalId, name } = IdentifySchema.parse(req.body);
    const convo = await prisma.conversation.findUnique({ where: { id: req.params.conversationId }, select: { id: true, workspaceId: true, contactId: true } });
    if (!convo) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such conversation" } });

    const identifiedId = await resolveContactId(convo.workspaceId, "external", externalId, name);
    if (identifiedId !== convo.contactId) {
      await prisma.$transaction(async (tx) => {
        await tx.identity.updateMany({ where: { contactId: convo.contactId }, data: { contactId: identifiedId } });
        await tx.conversation.updateMany({ where: { contactId: convo.contactId }, data: { contactId: identifiedId } });
        await tx.contact.delete({ where: { id: convo.contactId } }).catch(() => undefined); // idempotent
      });
    }
    return { contactId: identifiedId };
  });
}
