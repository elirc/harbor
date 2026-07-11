import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  // Vite dev server origin — allowed by CORS.
  WEB_URL: z.string().url().default("http://localhost:5173"),
  // Optional so the API can boot (health + ws echo) without a database in dev/CI.
  DATABASE_URL: z.string().url().optional(),
});

/**
 * Validate env at boot. Bad config crashes HERE with a clear message — not at the first
 * request that happens to need the missing value.
 */
export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
