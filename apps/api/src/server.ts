import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./env";
import { healthRoutes } from "./routes/health";
import { conversationRoutes } from "./routes/conversations";
import { contactRoutes } from "./routes/contacts";
import { inboundRoutes } from "./routes/inbound";
import { inboxRoutes } from "./routes/inbox";

/** Build (but don't start) the app so tests can boot it in-process via `app.inject(...)`. */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV === "production" ? { level: "info" } : false });
  void app.register(cors, { origin: env.WEB_URL });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      void reply.code(400).send({ error: { code: "VALIDATION", message: "Invalid request" } });
      return;
    }
    void reply.code(500).send({ error: { code: "INTERNAL", message: "Internal error" } });
  });

  void app.register(healthRoutes);
  void app.register(conversationRoutes);
  void app.register(contactRoutes);
  void app.register(inboundRoutes);
  void app.register(inboxRoutes);
  return app;
}
