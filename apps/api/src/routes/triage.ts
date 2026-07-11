import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@harbor/db";
import { structuredComplete } from "@harbor/llm";
import { DEFAULT_MODEL } from "@harbor/llm";
import { TriageOutputSchema, UNCLASSIFIED, TRIAGE_SYSTEM, buildTriagePrompt, type TriageOutput } from "@harbor/shared";
import { providerFor } from "../llm";

/**
 * AI triage (S11). Classify a conversation into a schema-validated TriageOutput and attach it as an AIAction —
 * a SUGGESTION, never an auto-action. The structured call is wrapped in validate → reprompt → fallback, so
 * malformed model output degrades to UNCLASSIFIED instead of crashing. Routing (S06) and humans consume it.
 */
export async function triageRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string } }>("/conversations/:id/triage", async (req, reply) => {
    const convo = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { messages: { where: { direction: "inbound" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!convo) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such conversation" } });
    const customerMessage = convo.messages[0]?.parsed ?? convo.subject;

    const result = await structuredComplete<TriageOutput>(providerFor("triage"), {
      model: DEFAULT_MODEL,
      system: TRIAGE_SYSTEM,
      user: buildTriagePrompt(customerMessage), // ⚠️ raw customer text enters the prompt (S13 hardens this)
      schema: TriageOutputSchema,
      fallback: UNCLASSIFIED,
      maxTokens: 256,
    });

    const action = await prisma.aIAction.create({
      data: {
        conversationId: convo.id,
        type: "triage",
        payload: result.value as unknown as Prisma.InputJsonValue,
        reasoning: result.value.reasoning,
        confidence: result.value.confidence,
      },
    });
    return { id: action.id, triage: result.value, ok: result.ok, retried: result.retried, fellBack: result.fellBack };
  });

  /**
   * 📘 The DATA FLYWHEEL. An agent correcting a triage isn't just a fix — it's a free labeled example. We store
   * the correction; a job (or export) turns corrected AIActions into new eval cases, so today's mistake becomes
   * tomorrow's regression test. Mislabeled triage is the most valuable training data you have.
   */
  app.post<{ Params: { id: string }; Body: unknown }>("/ai-actions/:id/correct", async (req, reply) => {
    const correction = TriageOutputSchema.partial().parse(req.body);
    const action = await prisma.aIAction
      .update({ where: { id: req.params.id }, data: { correctedPayload: correction as unknown as Prisma.InputJsonValue } })
      .catch(() => null);
    if (!action) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such action" } });
    return { id: action.id, corrected: correction };
  });
}
