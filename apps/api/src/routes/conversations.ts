import type { FastifyInstance } from "fastify";
import { prisma } from "@harbor/db";
import { PostMessageSchema, type InboxItem } from "@harbor/shared";

/**
 * The walking skeleton (S01): post a message into a conversation, and list the inbox. This is the whole
 * persistence surface for now. A message stores `raw` and `parsed` identically today; S03's email parsing is
 * what makes them diverge (raw = MIME, parsed = stripped/threaded) — the columns are here so that's a
 * fill-in, not a migration.
 */
export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  // The agent inbox: most-recently-updated conversations with a preview.
  app.get("/inbox", async () => {
    const convos = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const items: InboxItem[] = convos.map((c) => ({
      conversationId: c.id,
      subject: c.subject,
      state: c.state as InboxItem["state"],
      lastMessagePreview: (c.messages[0]?.parsed ?? "").slice(0, 120),
      updatedAt: c.updatedAt.toISOString(),
    }));
    return items;
  });

  app.get<{ Params: { id: string } }>("/conversations/:id", async (req, reply) => {
    const convo = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: "asc" } }, contact: true },
    });
    if (!convo) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "conversation not found" } });
    return convo;
  });

  app.post<{ Params: { id: string } }>("/conversations/:id/messages", async (req, reply) => {
    const { body, direction } = PostMessageSchema.parse(req.body);
    const convo = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!convo) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "conversation not found" } });

    const message = await prisma.message.create({
      // parsed == raw in S01. From S03, the inbound pipeline sets parsed = strip(thread(raw)).
      data: { conversationId: convo.id, direction, raw: body, parsed: body },
    });
    await prisma.conversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });
    return reply.code(201).send({ id: message.id });
  });
}
