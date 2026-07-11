import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@harbor/db";
import { pickSurvivor } from "@harbor/shared";

/**
 * Contact identity (S02): resolve-or-create on an inbound identifier, merge duplicates, and the contact
 * profile. The pure decision logic (winner selection, the race) is modeled + tested in @harbor/shared's
 * IdentityResolver; these handlers are the DB wiring of the same rules.
 */
const ResolveSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(["email", "messenger", "external"]),
  value: z.string().min(1),
  verified: z.boolean().default(false),
  name: z.string().optional(),
});

export async function contactRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Resolve-or-create a contact for an inbound identifier. 🔗 Pulse S6's race, restated: a concurrent second
   * inbound on the same NEW identifier would create a duplicate contact — so we take a Postgres ADVISORY LOCK
   * keyed on the identifier before the check-then-create. Same shape as the IdentityResolver's KeyedMutex;
   * the lock is per-identifier, so different identifiers still resolve in parallel.
   */
  app.post("/contacts/resolve", async (req, reply) => {
    const input = ResolveSchema.parse(req.body);
    const lockKey = `${input.workspaceId}|${input.type}|${input.value}`;

    const contactId = await prisma.$transaction(async (tx) => {
      // Advisory xact lock — released automatically at transaction end. hashtext() maps the key to an int.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const existing = await tx.identity.findUnique({
        where: { workspaceId_type_value: { workspaceId: input.workspaceId, type: input.type, value: input.value } },
        select: { contactId: true },
      });
      if (existing) return existing.contactId;
      const contact = await tx.contact.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          identities: { create: { workspaceId: input.workspaceId, type: input.type, value: input.value, verified: input.verified } },
        },
      });
      return contact.id;
    });
    return reply.code(200).send({ contactId });
  });

  /** Merge two contacts: oldest wins; fold identities + conversations; idempotent. */
  app.post<{ Body: { aId: string; bId: string } }>("/contacts/merge", async (req, reply) => {
    const { aId, bId } = z.object({ aId: z.string(), bId: z.string() }).parse(req.body);
    if (aId === bId) return { survivorId: aId };

    const survivorId = await prisma.$transaction(async (tx) => {
      const [a, b] = await Promise.all([
        tx.contact.findUnique({ where: { id: aId }, select: { id: true, createdAt: true } }),
        tx.contact.findUnique({ where: { id: bId }, select: { id: true, createdAt: true } }),
      ]);
      if (!a || !b) return a?.id ?? b?.id ?? aId; // already merged
      const survivor = pickSurvivor({ id: a.id, createdAt: a.createdAt.getTime() }, { id: b.id, createdAt: b.createdAt.getTime() });
      const loser = survivor.id === aId ? bId : aId;
      // Reattach the loser's identities + conversations to the survivor, then delete the loser — atomic in
      // this transaction, so no conversation is ever orphaned mid-merge.
      await tx.identity.updateMany({ where: { contactId: loser }, data: { contactId: survivor.id } });
      await tx.conversation.updateMany({ where: { contactId: loser }, data: { contactId: survivor.id } });
      await tx.contact.delete({ where: { id: loser } });
      return survivor.id;
    });
    return reply.code(200).send({ survivorId });
  });

  app.get<{ Params: { id: string } }>("/contacts/:id", async (req, reply) => {
    const contact = await prisma.contact
      .findUnique({
        where: { id: req.params.id },
        include: { identities: true, conversations: { orderBy: { updatedAt: "desc" }, select: { id: true, subject: true, state: true } } },
      })
      .catch(() => null);
    if (!contact) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "contact not found" } });
    return contact;
  });
}
