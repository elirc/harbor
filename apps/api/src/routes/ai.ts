import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Prisma } from "@harbor/db";
import { DEFAULT_AUTONOMY, summarizeThreadPrompt, adjustTonePrompt } from "@harbor/shared";
import { DEFAULT_MODEL } from "@harbor/llm";
import { llm } from "../llm";

/**
 * Autonomy settings + agent AI assists (S14). Assists are LOW-RISK: human-triggered and human-sent (the agent
 * always edits/sends). Risk scales with autonomy, and so does eval rigor — auto-reply has the highest bar, an
 * assist the lowest.
 */
const AutonomySchema = z.object({
  mode: z.enum(["off", "draft", "auto_cc", "auto"]),
  topicAllowlist: z.array(z.string()),
  businessHoursOnly: z.boolean(),
  minConfidence: z.number().min(0).max(1),
  minRetrievalScore: z.number().min(0).max(1),
});

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/workspaces/:id/autonomy", async (req) => {
    const row = await prisma.autonomySetting.findUnique({ where: { workspaceId: req.params.id } });
    return row?.settings ?? DEFAULT_AUTONOMY; // safe default: OFF
  });

  app.put<{ Params: { id: string }; Body: unknown }>("/workspaces/:id/autonomy", async (req) => {
    const settings = AutonomySchema.parse(req.body);
    const row = await prisma.autonomySetting.upsert({
      where: { workspaceId: req.params.id },
      create: { workspaceId: req.params.id, settings: settings as unknown as Prisma.InputJsonValue },
      update: { settings: settings as unknown as Prisma.InputJsonValue },
    });
    return row.settings;
  });

  /** Summarize a conversation for an agent picking it up (human-triggered assist). */
  app.post<{ Params: { id: string } }>("/conversations/:id/summarize", async (req, reply) => {
    const msgs = await prisma.message.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: "asc" }, select: { parsed: true } });
    if (msgs.length === 0) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no messages" } });
    const res = await llm.complete({ model: DEFAULT_MODEL, messages: [{ role: "user", content: summarizeThreadPrompt(msgs.map((m) => m.parsed)) }], maxTokens: 200 }, "assist-summarize");
    return { summary: res.text };
  });

  /** Adjust the tone of a draft, preserving facts + citations (human-triggered, human-sent). */
  app.post<{ Body: unknown }>("/assist/tone", async (req) => {
    const { draft, tone } = z.object({ draft: z.string().min(1), tone: z.enum(["friendlier", "more_formal", "more_concise"]) }).parse(req.body);
    const res = await llm.complete({ model: DEFAULT_MODEL, messages: [{ role: "user", content: adjustTonePrompt(draft, tone) }], maxTokens: 400 }, "assist-tone");
    return { rewritten: res.text };
  });
}
