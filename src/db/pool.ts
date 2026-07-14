import pg from "pg";
import { config } from "../config.js";
import { initSchema } from "./repo.js";

/** Create a real PostgreSQL pool and ensure the schema exists. */
export async function createPool(): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  await initSchema(pool);
  return pool;
}
