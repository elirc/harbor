import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Prisma } from "@harbor/db";
import { MockEmbedder } from "@harbor/rag";
import { DEFAULT_RELEVANCE_THRESHOLD } from "@harbor/rag";
import { selectModel, MAX_ANSWER_TOKENS, costUsd } from "@harbor/llm";
import { refusalReason, buildGroundedPrompt, verifyCitations, isAcceptableAnswer, REFUSAL_MESSAGE, redactPII, ContactCostLedger } from "@harbor/shared";
import { autonomyDecision, buildHandoffNote, DEFAULT_AUTONOMY, type AutonomySettings } from "@harbor/shared";
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
    const confidence = refused ? 0 : Math.min(1, relevant[0]?.score ?? 0);

    // 🔒 S14 AUTONOMY GATE. Load the workspace's settings (absent ⇒ OFF) and decide auto-send vs draft vs
    // handoff. The safe answer at every branch is "let a human handle it," never "act anyway."
    const settingsRow = await prisma.autonomySetting.findUnique({ where: { workspaceId } });
    const settings = (settingsRow?.settings as unknown as AutonomySettings) ?? DEFAULT_AUTONOMY;
    const topic = await topicOf(conversationId); // from the latest triage AIAction
    const decision = autonomyDecision({ settings, refused, confidence, retrievalScore: relevant[0]?.score ?? 0, topic, businessHoursOk: true });

    if (conversationId) {
      const isAuto = decision.action === "auto_send" || decision.action === "auto_send_cc";
      if (isAuto) {
        // The bot ACTS: send an outbound reply. (auto_cc additionally leaves an agent-visible note.)
        await prisma.message.create({ data: { conversationId, direction: "outbound", raw: answer, parsed: answer } });
        if (decision.action === "auto_send_cc") await prisma.message.create({ data: { conversationId, direction: "note", raw: `🤖 auto-replied (CC): ${decision.reason}`, parsed: `🤖 auto-replied (CC): ${decision.reason}` } });
      } else if (decision.action === "handoff") {
        const recent = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 3, select: { parsed: true } });
        const note = buildHandoffNote(question, recent.map((m) => m.parsed).reverse(), { answer, refused, reason, citations: citations.cited });
        await prisma.message.create({ data: { conversationId, direction: "note", raw: note, parsed: note } });
      }
      await prisma.aIAction.create({
        data: {
          conversationId,
          type: isAuto ? "bot_reply" : "bot_draft",
          payload: { answer, refused, reason, citations, action: decision.action } as unknown as Prisma.InputJsonValue,
          reasoning: decision.reason,
          confidence,
        },
      });
    }
    return { answer, refused, reason, action: decision.action, actionReason: decision.reason, sources: relevant.map((r) => ({ id: r.id, score: r.score })), grounded: citations.grounded };
  });
}

/** The conversation's current topic = its latest triage intent (else "other"). Feeds the autonomy allowlist. */
async function topicOf(conversationId: string | undefined): Promise<string> {
  if (!conversationId) return "other";
  const triage = await prisma.aIAction.findFirst({ where: { conversationId, type: "triage" }, orderBy: { createdAt: "desc" } });
  const intent = (triage?.payload as { intent?: string } | null)?.intent;
  return intent ?? "other";
}
