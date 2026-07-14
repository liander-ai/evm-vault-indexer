import { describe, it, expect, beforeEach } from "vitest";
import { newDb } from "pg-mem";
import {
  initSchema,
  insertEvents,
  getEvents,
  getUserStats,
  type Queryable,
  type NewEvent,
} from "../src/db/repo.js";
import { logToEvent } from "../src/indexer/indexer.js";

function memDb(): Queryable {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";

function ev(over: Partial<NewEvent>): NewEvent {
  return {
    userAddress: A,
    eventType: "Staked",
    amount: 1000n,
    blockNumber: 1n,
    txHash: "0xtx",
    logIndex: 0,
    ...over,
  };
}

describe("repo", () => {
  let db: Queryable;
  beforeEach(async () => {
    db = memDb();
    await initSchema(db);
  });

  it("inserts and reads back an event (lowercased address)", async () => {
    const n = await insertEvents(db, [ev({ txHash: "0xa", userAddress: A.toUpperCase() })]);
    expect(n).toBe(1);
    const rows = await getEvents(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_address).toBe(A.toLowerCase());
    expect(String(rows[0].amount)).toBe("1000");
  });

  it("de-duplicates on (tx_hash, log_index) when re-indexed", async () => {
    // Re-indexing an overlapping block range must not create duplicate rows.
    await insertEvents(db, [ev({ txHash: "0xa", logIndex: 0 })]);
    await insertEvents(db, [ev({ txHash: "0xa", logIndex: 0 })]);
    expect(await getEvents(db)).toHaveLength(1);
  });

  it("filters by user and by type", async () => {
    await insertEvents(db, [
      ev({ txHash: "0xa", userAddress: A, eventType: "Staked" }),
      ev({ txHash: "0xb", userAddress: B, eventType: "Staked" }),
      ev({ txHash: "0xc", userAddress: A, eventType: "Claimed" }),
    ]);
    expect(await getEvents(db, { user: A })).toHaveLength(2);
    expect(await getEvents(db, { type: "Claimed" })).toHaveLength(1);
    expect(await getEvents(db, { user: A, type: "Staked" })).toHaveLength(1);
  });

  it("aggregates per-user staked / unstaked / claimed totals", async () => {
    await insertEvents(db, [
      ev({ txHash: "0xa", eventType: "Staked", amount: 1000n }),
      ev({ txHash: "0xb", eventType: "Staked", amount: 500n }),
      ev({ txHash: "0xc", eventType: "Claimed", amount: 100n }),
      ev({ txHash: "0xd", eventType: "Unstaked", amount: 300n }),
    ]);
    const s = await getUserStats(db, A);
    expect(String(s.totalStaked)).toBe("1500");
    expect(String(s.totalClaimed)).toBe("100");
    expect(String(s.totalUnstaked)).toBe("300");
  });

  it("returns zeroed stats for an unknown user", async () => {
    const s = await getUserStats(db, B);
    expect(String(s.totalStaked)).toBe("0");
  });
});

describe("logToEvent", () => {
  it("maps a Claimed log's reward arg to amount", () => {
    const e = logToEvent({
      eventName: "Claimed",
      args: { user: A, reward: 42n },
      blockNumber: 7n,
      transactionHash: "0xz",
      logIndex: 3,
    });
    expect(e).toEqual({
      userAddress: A,
      eventType: "Claimed",
      amount: 42n,
      blockNumber: 7n,
      txHash: "0xz",
      logIndex: 3,
    });
  });
});
