import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/vault_indexer",
  rpcUrl: process.env.RPC_URL ?? "http://127.0.0.1:8545",
  vaultAddress: (process.env.VAULT_ADDRESS ?? "") as `0x${string}`,
  startBlock: BigInt(process.env.START_BLOCK ?? "0"),
};
