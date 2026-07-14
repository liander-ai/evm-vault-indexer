// Data-access layer for indexed staking events.
//
// Written against a minimal `Queryable` interface so the exact same code runs
// on a real PostgreSQL pool (node-postgres) in production and on an in-memory
// pg-mem instance in tests.

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export type EventType = "Staked" | "Unstaked" | "Claimed";

export interface StakeEvent {
  id: number;
  user_address: string;
  event_type: EventType;
  amount: string; // wei, kept as string to avoid precision loss
  block_number: string;
  tx_hash: string;
  log_index: number;
}

export interface NewEvent {
  userAddress: string;
  eventType: EventType;
  amount: bigint;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}

/** Create the events table and its indexes if they do not exist. */
export async function initSchema(db: Queryable): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stake_events (
      id            SERIAL PRIMARY KEY,
      user_address  TEXT    NOT NULL,
      event_type    TEXT    NOT NULL,
      amount        NUMERIC NOT NULL,
      block_number  BIGINT  NOT NULL,
      tx_hash       TEXT    NOT NULL,
      log_index     INTEGER NOT NULL,
      UNIQUE (tx_hash, log_index)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_stake_events_user ON stake_events (user_address);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_stake_events_type ON stake_events (event_type);`);
}

/**
 * Insert events idempotently. Re-indexing the same block range is safe because
 * (tx_hash, log_index) is unique and conflicts are ignored. Returns the number
 * of rows actually inserted.
 */
export async function insertEvents(db: Queryable, events: NewEvent[]): Promise<number> {
  let inserted = 0;
  for (const e of events) {
    const res = await db.query(
      `INSERT INTO stake_events (user_address, event_type, amount, block_number, tx_hash, log_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tx_hash, log_index) DO NOTHING
       RETURNING id`,
      [
        e.userAddress.toLowerCase(),
        e.eventType,
        e.amount.toString(),
        e.blockNumber.toString(),
        e.txHash,
        e.logIndex,
      ]
    );
    inserted += res.rows.length;
  }
  return inserted;
}

/** Recent events, optionally filtered by user and/or event type. */
export async function getEvents(
  db: Queryable,
  opts: { user?: string; type?: EventType; limit?: number } = {}
): Promise<StakeEvent[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.user) {
    params.push(opts.user.toLowerCase());
    clauses.push(`user_address = $${params.length}`);
  }
  if (opts.type) {
    params.push(opts.type);
    clauses.push(`event_type = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  params.push(limit);

  const res = await db.query(
    `SELECT id,
            user_address,
            event_type,
            amount::text        AS amount,
            block_number::text  AS block_number,
            tx_hash,
            log_index
     FROM stake_events
     ${where}
     ORDER BY block_number DESC, log_index DESC
     LIMIT $${params.length}`,
    params
  );
  return res.rows as StakeEvent[];
}

export interface UserStats {
  user: string;
  totalStaked: string;
  totalUnstaked: string;
  totalClaimed: string;
}

/** Aggregate staked / unstaked / claimed totals for a single user. */
export async function getUserStats(db: Queryable, user: string): Promise<UserStats> {
  const res = await db.query(
    `SELECT
       SUM(CASE WHEN event_type = 'Staked'   THEN amount ELSE 0 END)::text AS staked,
       SUM(CASE WHEN event_type = 'Unstaked' THEN amount ELSE 0 END)::text AS unstaked,
       SUM(CASE WHEN event_type = 'Claimed'  THEN amount ELSE 0 END)::text AS claimed
     FROM stake_events
     WHERE user_address = $1`,
    [user.toLowerCase()]
  );
  const r = res.rows[0] ?? {};
  return {
    user: user.toLowerCase(),
    totalStaked: r.staked ?? "0",
    totalUnstaked: r.unstaked ?? "0",
    totalClaimed: r.claimed ?? "0",
  };
}
