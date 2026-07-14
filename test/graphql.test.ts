import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newDb } from "pg-mem";
import { initSchema, insertEvents, type Queryable } from "../src/db/repo.js";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

function memDb(): Queryable {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

const A = "0x1111111111111111111111111111111111111111";

async function gql(app: FastifyInstance, query: string) {
  const res = await app.inject({
    method: "POST",
    url: "/graphql",
    payload: { query },
  });
  return res.json();
}

describe("graphql api", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const db = memDb();
    await initSchema(db);
    await insertEvents(db, [
      { userAddress: A, eventType: "Staked", amount: 1000n, blockNumber: 1n, txHash: "0xa", logIndex: 0 },
      { userAddress: A, eventType: "Claimed", amount: 100n, blockNumber: 2n, txHash: "0xb", logIndex: 0 },
    ]);
    app = await buildServer(db);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves events over GraphQL", async () => {
    const body = await gql(app, `{ events(user: "${A}") { type amount txHash } }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.events).toHaveLength(2);
    expect(body.data.events.map((e: { type: string }) => e.type).sort()).toEqual(["Claimed", "Staked"]);
  });

  it("serves aggregated userStats", async () => {
    const body = await gql(app, `{ userStats(user: "${A}") { totalStaked totalClaimed } }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.userStats.totalStaked).toBe("1000");
    expect(body.data.userStats.totalClaimed).toBe("100");
  });

  it("responds on /health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ ok: true });
  });
});
