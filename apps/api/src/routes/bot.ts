import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Prisma } from "@harbor/db";
import { MockEmbedder } from "@harbor/rag";
import { DEFAULT_RELEVANCE_THRESHOLD } from "@harbor/rag";
import { selectModel, MAX_ANSWER_TOKENS, costUsd } from "@harbor/llm";
import { refusalReason, buildGroundedPrompt, verifyCitations, isAcceptableAnswer, REFUSAL_MESSAGE, redactPII, ContactCostLedger } from "@harbor/shared";
import { llm } from "../llm";

// 🔒 S13: per-contact LLM-cost ceiling — an abusive user can't run up the bill. In-memory here; a durable
// counter (Redis/DB) in production. Bounded blast radius for cost abuse.
const contactCost = new ContactCostLedger(0.5);

/**
 * The answer-bot (S12). Draft a grounded reply — or refuse. The order of operations IS the guardrail:
 *   retrieve with a relevance threshold → decide refuse-or-answer → generate strictly from context →
 *   verify citations → suppress an ungrounded answer to a refusal. Assistive: the draft goes to an agent to
 *   review/edit/send (autonomy is S14).
 */
const embedder = new MockEmbedder(96);
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export async function botRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>("/bot/draft", async (req, reply) => {
    const body = z
      .object({ question: z.string().optional(), conversationId: z.string().optional(), workspaceId: z.string().default("demo-ws") })
      .parse(req.body);
    const { conversationId, workspaceId } = body;

    // The question is the customer's latest inbound message (or a direct `question` for the help-center box).
    let question = body.question;
    if (!question && conversationId) {
      const convo = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { messages: { where: { direction: "inbound" }, orderBy: { createdAt: "desc" }, take: 1 } } });
      question = convo?.messages[0]?.parsed ?? convo?.subject;
    }
    if (!question) return reply.code(400).send({ error: { code: "VALIDATION", message: "no question" } });

    // 🔒 S13: enforce the per-contact cost ceiling before spending on retrieval + generation.
    if (conversationId && !contactCost.withinBudget(conversationId)) {
      return { answer: REFUSAL_MESSAGE, refused: true, reason: "cost_ceiling", sources: [], grounded: false };
    }

    // 1. Retrieve WITH a relevance threshold (S12 harvest of flaw #3): score = 1 - cosine distance.
    // (Redact PII from the question before it ships to the model — grounding comes from docs, not the PII.)
    const qVec = toVectorLiteral(embedder.embed(redactPII(question)));
    const rows = await prisma.$queryRaw<Array<{ id: string; text: string; score: number }>>`
      SELECT "id", "text", 1 - ("embedding" <=> ${qVec}::vector) AS score
      FROM "ArticleChunk"
      WHERE "workspaceId" = ${workspaceId} AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> ${qVec}::vector LIMIT 5`;
    const relevant = rows.filter((r) => r.score >= DEFAULT_RELEVANCE_THRESHOLD);

    // 2. Decide: refuse on weak retrieval or sensitive topic, else answer.
    const reason = refusalReason(question, relevant.length > 0);
    let answer: string;
    let refused = true;
    if (reason) {
      answer = REFUSAL_MESSAGE;
    } else {
      // 3. Generate strictly from the retrieved context.
      const res = await llm.complete(
        {
          model: selectModel("generate"),
          system: "You are a support answer-bot. Ground every claim in the provided context and cite it.",
          messages: [{ role: "user", content: buildGroundedPrompt(redactPII(question), relevant.map((r) => ({ id: r.id, text: r.text }))) }],
          maxTokens: MAX_ANSWER_TOKENS,
        },
        "bot-draft",
      );
      if (conversationId) contactCost.record(conversationId, costUsd(selectModel("generate"), res.usage)); // tally per-contact spend
      // 4. Verify citations; an ungrounded answer is a bug — suppress it to a refusal rather than ship it.
      answer = isAcceptableAnswer(res.text, relevant.length) ? res.text : REFUSAL_MESSAGE;
      refused = answer === REFUSAL_MESSAGE;
    }

    const citations = verifyCitations(answer, relevant.length);
    if (conversationId) {
      await prisma.aIAction.create({
        data: {
          conversationId,
          type: "bot_draft",
          payload: { answer, refused, reason, citations } as unknown as Prisma.InputJsonValue,
          reasoning: reason ?? "grounded answer",
          confidence: refused ? 0 : Math.min(1, relevant[0]?.score ?? 0),
        },
      });
    }
    return { answer, refused, reason, sources: relevant.map((r) => ({ id: r.id, score: r.score })), grounded: citations.grounded };
  });
}
