import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness: is the process up? Readiness (can it reach PG + Redis?) is split out later.
  app.get("/health", async () => ({ status: "ok" }));
}
