# EVM Vault Indexer

A small backend that **indexes on-chain staking events into PostgreSQL and serves them over a GraphQL API.**

It indexes the [`StakingVault`](https://github.com/liander-ai/evm-staking-vault) contract (my Solidity staking vault): it reads `Staked` / `Unstaked` / `Claimed` events from an EVM RPC with [viem](https://viem.sh), stores them in Postgres, and exposes queryable history and per-user aggregates through a Fastify + Mercurius GraphQL endpoint.

## Architecture

```
EVM chain ──(viem getLogs)──> Indexer ──> PostgreSQL ──> GraphQL API (Fastify + Mercurius) ──> clients
```

- **Indexer** (`src/indexer/`) fetches logs in block-range chunks, decodes them with viem, and upserts rows. Idempotent: re-indexing an overlapping range never creates duplicates (unique on `tx_hash, log_index`).
- **Database** (`src/db/`) is PostgreSQL via `node-postgres`, with a single indexed `stake_events` table.
- **API** (`src/graphql/`, `src/server.ts`) is a Fastify server with a Mercurius GraphQL schema.

## GraphQL

```graphql
# Recent events, optionally filtered
{
  events(user: "0xabc...", type: Staked, limit: 20) {
    type
    amount
    blockNumber
    txHash
  }
}

# Aggregated totals for one user (wei, as strings)
{
  userStats(user: "0xabc...") {
    totalStaked
    totalUnstaked
    totalClaimed
  }
}
```

Open GraphiQL at `http://localhost:4000/graphiql` when the server is running.

## Run it

With Docker (Postgres + API):

```bash
docker compose up --build
```

Or locally against your own Postgres:

```bash
cp .env.example .env       # set DATABASE_URL, RPC_URL, VAULT_ADDRESS
npm install
npm run index              # backfill events from the chain
npm run dev                # start the GraphQL server (http://localhost:4000)
```

## Tests

```bash
npm test        # vitest
npm run typecheck
```

```
✓ test/repo.test.ts (6 tests)
✓ test/graphql.test.ts (3 tests)
Test Files  2 passed (2)
     Tests  9 passed (9)
```

The suite runs the real data-access and GraphQL code against an in-memory Postgres ([pg-mem](https://github.com/oguimbal/pg-mem)), so `npm test` needs no database. Production uses real PostgreSQL; the same repository code serves both.

## Stack

- **Fastify 5** + **Mercurius** (GraphQL)
- **PostgreSQL** via **node-postgres** (`pg`)
- **viem** for reading and decoding on-chain logs
- **TypeScript**, **Vitest** (+ `pg-mem`), **Docker Compose**

## Layout

```
src/db/repo.ts            SQL data-access (portable across pg and pg-mem)
src/db/pool.ts            real PostgreSQL pool + schema init
src/indexer/indexer.ts    viem log fetch + decode -> rows
src/indexer/run.ts        backfill entry point
src/graphql/schema.ts     GraphQL SDL
src/graphql/resolvers.ts  resolvers
src/server.ts             Fastify + Mercurius wiring
test/                     Vitest suites (pg-mem)
```

## License

MIT
