import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@harbor/db";
import { MockEmbedder, parseSections, chunkStructured, reciprocalRankFusion } from "@harbor/rag";
import { DEFAULT_MODEL } from "@harbor/llm";
import { llm } from "../llm";

/**
 * RAG routes (S10). Retrieval is the product; generation is a thin final step. In dev/CI the query is embedded
 * with the deterministic MockEmbedder and generation runs on the mock model; production swaps a real embedding
 * client + the real Claude client behind the same interfaces.
 */
const embedder = new MockEmbedder(96);

/** Format a JS number[] as a pgvector literal: [0.1,0.2,...]. */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export async function ragRoutes(app: FastifyInstance): Promise<void> {
  /** Embed an article's chunks into pgvector (embed-on-publish / backfill). Versions the vectors by model. */
  app.post<{ Params: { id: string } }>("/rag/articles/:id/embed", async (req, reply) => {
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such article" } });

    const doc = parseSections(`# ${article.title}\n\n${article.body}`);
    const chunks = chunkStructured(doc, { articleSlug: article.slug });
    await prisma.articleChunk.deleteMany({ where: { articleId: article.id } });
    for (const c of chunks) {
      const created = await prisma.articleChunk.create({
        data: { workspaceId: article.workspaceId, articleId: article.id, text: c.text, heading: c.metadata.heading ?? "", position: c.metadata.position, index: c.index },
      });
      const vec = toVectorLiteral(embedder.embed(c.text));
      // pgvector column is Unsupported in the Prisma client → write via raw SQL.
      await prisma.$executeRaw`UPDATE "ArticleChunk" SET "embedding" = ${vec}::vector, "embeddingModel" = ${embedder.model}, "embeddingDim" = ${embedder.dim} WHERE "id" = ${created.id}`;
    }
    return { chunks: chunks.length, model: embedder.model };
  });

  /**
   * Answer a question over the help center. HYBRID retrieval: fuse pgvector (semantic) with FTS (lexical) via
   * reciprocal rank fusion, then feed the top chunks to a thin grounded-generation step. Guardrails, citations,
   * and a refusal threshold arrive in S12 — this is deliberately raw.
   */
  app.post<{ Body: unknown }>("/rag/answer", async (req, reply) => {
    const { question, workspaceId } = z.object({ question: z.string().min(1), workspaceId: z.string().default("demo-ws") }).parse(req.body);
    const qVec = toVectorLiteral(embedder.embed(question));

    // Vector ranking (cosine via pgvector <=>) and lexical ranking (FTS), each returning ordered chunk ids.
    const vector = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ArticleChunk"
      WHERE "workspaceId" = ${workspaceId} AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> ${qVec}::vector LIMIT 10`;
    const lexical = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ArticleChunk"
      WHERE "workspaceId" = ${workspaceId} AND to_tsvector('english', "text") @@ plainto_tsquery('english', ${question})
      ORDER BY ts_rank(to_tsvector('english', "text"), plainto_tsquery('english', ${question})) DESC LIMIT 10`;

    const fused = reciprocalRankFusion([vector.map((r) => r.id), lexical.map((r) => r.id)]).slice(0, 5);
    if (fused.length === 0) return reply.code(200).send({ answer: "", chunks: [], grounded: false });

    const chunks = await prisma.articleChunk.findMany({ where: { id: { in: fused.map((f) => f.id) } }, select: { id: true, text: true, heading: true } });
    const context = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
    const res = await llm.complete(
      {
        model: DEFAULT_MODEL,
        system: "You are a support assistant. Answer using ONLY the provided context.",
        messages: [{ role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }],
        maxTokens: 512,
      },
      "rag-answer",
    );
    return { answer: res.text, chunks, grounded: true };
  });
}
