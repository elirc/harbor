import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@harbor/db";
import { parseEmail, stripForDisplay, threadEmail } from "@harbor/mailin";

/**
 * Inbound email pipeline (S03, threading hardened S07): provider webhook → parse MIME → resolve contact (S02)
 * → thread → Message.
 *
 * 🔍 DISPLAY-STRIP, STORE-RAW. We store the untouched MIME in `raw` and the stripped, display-ready body in
 * `parsed`. Stripping is a *view*; the original is never mutated, so a wrong strip is recoverable via the
 * "show original" toggle. Threading now follows the Message-ID chain (References/In-Reply-To), falling back to
 * subject only within the same contact — the S07 harvest of the S03 subject-only flaw.
 */
export async function inboundRoutes(app: FastifyInstance): Promise<void> {
  app.post("/inbound", async (req, reply) => {
    const { workspaceId, raw } = z.object({ workspaceId: z.string().min(1), raw: z.string().min(1) }).parse(req.body);
    const email = parseEmail(raw);

    // Resolve-or-create the contact by their From address (advisory-locked, per S02).
    const address = extractAddress(email.from);
    const lockKey = `${workspaceId}|email|${address}`;
    const contactId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const existing = await tx.identity.findUnique({
        where: { workspaceId_type_value: { workspaceId, type: "email", value: address } },
        select: { contactId: true },
      });
      if (existing) return existing.contactId;
      const contact = await tx.contact.create({
        data: { workspaceId, name: extractName(email.from), identities: { create: { workspaceId, type: "email", value: address, verified: true } } },
      });
      return contact.id;
    });

    // Thread on the Message-ID chain first, then subject scoped to THIS contact (S07 harvest of flaw #1).
    // Look up any conversation that owns a Message-ID this email replies to (the correct, robust signal).
    const chain = [email.inReplyTo, ...email.references].filter((id): id is string => Boolean(id));
    const knownRows = chain.length
      ? await prisma.message.findMany({ where: { messageId: { in: chain } }, select: { messageId: true, conversationId: true } })
      : [];
    const known = knownRows.filter((m): m is { messageId: string; conversationId: string } => m.messageId !== null);
    const open = await prisma.conversation.findMany({
      where: { workspaceId, state: { in: ["open", "pending", "snoozed"] } },
      select: { id: true, subject: true, contactId: true },
    });
    const result = threadEmail({ inReplyTo: email.inReplyTo, references: email.references, subject: email.subject, fromContactId: contactId }, known, open);
    const conversationId =
      result.conversationId ??
      (await prisma.conversation.create({ data: { workspaceId, contactId, subject: email.subject || "(no subject)" } })).id;

    // Store raw MIME + the display-stripped body + the Message-ID (so future replies can thread onto this).
    const displayBody = stripForDisplay(email.text || stripHtml(email.html));
    await prisma.message.create({ data: { conversationId, direction: "inbound", raw, parsed: displayBody, messageId: email.messageId } });
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    return reply.code(202).send({ conversationId, threaded: result.conversationId !== null, via: result.via });
  });
}

function extractAddress(from: string): string {
  const m = /<([^>]+)>/.exec(from);
  return (m ? m[1] : from).trim().toLowerCase();
}
function extractName(from: string): string | undefined {
  const m = /^\s*"?([^"<]+?)"?\s*</.exec(from);
  return m ? m[1].trim() : undefined;
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
