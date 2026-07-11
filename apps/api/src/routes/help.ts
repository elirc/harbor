import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@harbor/db";
import { slugify, publishedOnly, renderArticleHtml } from "@harbor/shared";

/**
 * Help center (S05). Two audiences, two surfaces:
 *  - PUBLIC (`/help/*`): server-rendered HTML for SEO — Harbor's ONE SSR surface. The agent app is behind auth
 *    and needs no SEO; the public help center lives or dies by search ranking, so it renders on the server.
 *  - AGENT (`/articles*`): JSON authoring API used by the agent app.
 */
const WriteSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(""),
  categoryId: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function helpRoutes(app: FastifyInstance): Promise<void> {
  // ── Public, server-rendered ─────────────────────────────────────────────
  app.get<{ Querystring: { workspaceId?: string } }>("/help/articles", async (req) => {
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    const articles = await prisma.article.findMany({
      where: { workspaceId, status: "published" },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, title: true, status: true },
    });
    return publishedOnly(articles); // belt-and-suspenders: never serve a draft even if the query drifts
  });

  app.get<{ Params: { slug: string }; Querystring: { workspaceId?: string } }>("/help/:slug", async (req, reply) => {
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    const article = await prisma.article.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: req.params.slug } },
      include: { category: { select: { name: true } } },
    });
    if (!article || article.status !== "published") {
      return reply.code(404).type("text/html").send("<!doctype html><title>Not found</title><h1>404</h1>");
    }
    const html = renderArticleHtml({
      slug: article.slug,
      title: article.title,
      body: article.body,
      status: article.status,
      categoryName: article.category?.name ?? null,
    });
    return reply.type("text/html").send(html);
  });

  // ── Agent authoring (JSON) ──────────────────────────────────────────────
  app.get<{ Querystring: { workspaceId?: string } }>("/articles", async (req) => {
    const workspaceId = req.query.workspaceId ?? "demo-ws";
    return prisma.article.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
  });

  app.post("/articles", async (req, reply) => {
    const input = WriteSchema.parse(req.body);
    const slug = await uniqueSlug(input.workspaceId, slugify(input.title));
    const article = await prisma.article.create({
      data: { workspaceId: input.workspaceId, title: input.title, body: input.body, categoryId: input.categoryId ?? null, status: input.status, slug },
    });
    return reply.code(201).send(article);
  });

  app.put<{ Params: { id: string } }>("/articles/:id", async (req, reply) => {
    const input = WriteSchema.partial({ workspaceId: true }).parse(req.body);
    const article = await prisma.article
      .update({ where: { id: req.params.id }, data: { title: input.title, body: input.body, categoryId: input.categoryId ?? undefined, status: input.status } })
      .catch(() => null);
    if (!article) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "no such article" } });
    return article;
  });
}

/** Ensure the slug is unique within the workspace by appending -2, -3, … on collision. */
async function uniqueSlug(workspaceId: string, base: string): Promise<string> {
  let slug = base;
  for (let n = 2; ; n++) {
    const clash = await prisma.article.findUnique({ where: { workspaceId_slug: { workspaceId, slug } }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base}-${n}`;
  }
}
