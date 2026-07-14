import Fastify from "fastify";
import mercurius from "mercurius";
import { config } from "./config.js";
import { createPool } from "./db/pool.js";
import { schema } from "./graphql/schema.js";
import { resolvers, type Context } from "./graphql/resolvers.js";

/** Build the Fastify app wired to a given DB (real pool, or pg-mem in tests). */
export async function buildServer(db: Context["db"], opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(mercurius, {
    schema,
    resolvers: resolvers as never,
    context: (): Context => ({ db }),
    graphiql: true,
  });

  app.get("/health", async () => ({ ok: true }));
  return app;
}

async function main() {
  const pool = await createPool();
  const app = await buildServer(pool, { logger: true });
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

// Only start a real server when run directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
