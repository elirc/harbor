import type { FastifyInstance } from "fastify";
import { prisma, Prisma } from "@harbor/db";
import { chunkStructured, parseSections } from "@harbor/rag";

/**
 * Help-center search + the chunking pipeline (S08). No model yet — this is Postgres full-text search and the
 * preprocessing S10's embeddings will stand on.
 */
interface SearchHit {
  slug: string;
  title: string;
  snippet: string;
  rank: number;
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 🔗 [S] Weighted full-text search. Title matches outrank body matches (`setweight` A > B) — 🔗 Pulse S11:
   * what a doc is *about* lives in its title. `ts_headline` returns a snippet with the match highlighted, so
   * results are scannable. Every query — hit or miss — is logged; a zero-result query is a content-gap signal.
   */
  app.get<{ Querystring: { q?: string; workspaceId?: string } }>("/search", async (req) => {
    const q = (req.query.q ?? "").trim();
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    if (!q) return { query: q, hits: [] };

    const tsv = Prisma.sql`(setweight(to_tsvector('english', "title"), 'A') || setweight(to_tsvector('english', "body"), 'B'))`;
    const query = Prisma.sql`plainto_tsquery('english', ${q})`;
    const hits = await prisma.$queryRaw<SearchHit[]>`
      SELECT "slug", "title",
        ts_headline('english', "body", ${query}, 'MaxFragments=2, MinWords=5, MaxWords=18, ShortWord=2') AS snippet,
        ts_rank(${tsv}, ${query}) AS rank
      FROM "Article"
      WHERE "workspaceId" = ${workspaceId} AND "status" = 'published' AND ${tsv} @@ ${query}
      ORDER BY rank DESC
      LIMIT 10`;

    // 📘 Log the search — especially the misses. What people look for and don't find is the content roadmap.
    await prisma.searchQuery.create({ data: { workspaceId, query: q, resultCount: hits.length } });
    return { query: q, hits };
  });

  /** Content-gap report: the most common zero-result searches. Support pain → a writing to-do list. */
  app.get<{ Querystring: { workspaceId?: string } }>("/search/gaps", async (req) => {
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    const gaps = await prisma.searchQuery.groupBy({
      by: ["query"],
      where: { workspaceId, resultCount: 0 },
      _count: true,
      orderBy: { _count: { query: "desc" } },
      take: 20,
    });
    return gaps.map((g) => ({ query: g.query, misses: g._count }));
  });

  /**
   * Re-chunk an article into ArticleChunk rows (the S10 embedding input). Uses the structure-aware [S] chunker;
   * chunk quality is a hypothesis we can't grade until the eval harness (S09) exists — ADR-0008 says so.
   */
  app.post<{ Params: { id: string } }>("/articles/:id/reindex", async (req, reply) => {
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such article" } });

    const doc = parseSections(`# ${article.title}\n\n${article.body}`);
    const chunks = chunkStructured(doc, { articleSlug: article.slug });
    await prisma.$transaction([
      prisma.articleChunk.deleteMany({ where: { articleId: article.id } }),
      prisma.articleChunk.createMany({
        data: chunks.map((c) => ({ workspaceId: article.workspaceId, articleId: article.id, text: c.text, heading: c.metadata.heading ?? "", position: c.metadata.position, index: c.index })),
      }),
    ]);
    return { chunks: chunks.length };
  });
}
