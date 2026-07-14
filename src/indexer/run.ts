// Entry point: index StakingVault events from START_BLOCK to the chain head.
import { createPublicClient, http } from "viem";
import { config } from "../config.js";
import { createPool } from "../db/pool.js";
import { indexRange } from "./indexer.js";

async function main() {
  if (!config.vaultAddress) {
    throw new Error("Set VAULT_ADDRESS in the environment.");
  }

  const client = createPublicClient({ transport: http(config.rpcUrl) });
  const pool = await createPool();

  const head = await client.getBlockNumber();
  console.log(`Indexing vault ${config.vaultAddress} from block ${config.startBlock} to ${head}`);

  // Walk the range in chunks to stay under RPC getLogs limits.
  const CHUNK = 5000n;
  let inserted = 0;
  for (let from = config.startBlock; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
    inserted += await indexRange(pool, client, config.vaultAddress, from, to);
  }

  console.log(`Done. Inserted ${inserted} new events.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
