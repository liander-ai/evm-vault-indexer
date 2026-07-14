import { type Queryable, type EventType, getEvents, getUserStats } from "../db/repo.js";

export interface Context {
  db: Queryable;
}

/** Map a DB row (snake_case) to the GraphQL StakeEvent shape. */
function toGql(row: {
  id: number;
  user_address: string;
  event_type: string;
  amount: string;
  block_number: string;
  tx_hash: string;
  log_index: number;
}) {
  return {
    id: row.id,
    user: row.user_address,
    type: row.event_type,
    amount: row.amount,
    blockNumber: row.block_number,
    txHash: row.tx_hash,
    logIndex: row.log_index,
  };
}

export const resolvers = {
  Query: {
    events: async (
      _root: unknown,
      args: { user?: string; type?: EventType; limit?: number },
      ctx: Context
    ) => {
      const rows = await getEvents(ctx.db, {
        user: args.user,
        type: args.type,
        limit: args.limit,
      });
      return rows.map(toGql);
    },

    userStats: async (_root: unknown, args: { user: string }, ctx: Context) => {
      return getUserStats(ctx.db, args.user);
    },
  },
};
