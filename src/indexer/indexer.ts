// On-chain indexer: reads StakingVault events via viem and writes them to the DB.
import { type PublicClient, parseAbiItem } from "viem";
import { type Queryable, type NewEvent, insertEvents } from "../db/repo.js";

export const STAKE_EVENTS = [
  parseAbiItem("event Staked(address indexed user, uint256 amount)"),
  parseAbiItem("event Unstaked(address indexed user, uint256 amount)"),
  parseAbiItem("event Claimed(address indexed user, uint256 reward)"),
] as const;

/** Shape of a viem decoded log we care about (also used by tests). */
export interface DecodedLog {
  eventName: string;
  args: { user: string; amount?: bigint; reward?: bigint };
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
}

/** Map a decoded log to a DB row. `Claimed` carries `reward`; others `amount`. */
export function logToEvent(log: DecodedLog): NewEvent {
  const amount = log.eventName === "Claimed" ? log.args.reward : log.args.amount;
  return {
    userAddress: log.args.user,
    eventType: log.eventName as NewEvent["eventType"],
    amount: amount ?? 0n,
    blockNumber: log.blockNumber,
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  };
}

/**
 * Fetch StakingVault logs in [fromBlock, toBlock] and persist them.
 * Idempotent — safe to call over overlapping ranges. Returns rows inserted.
 */
export async function indexRange(
  db: Queryable,
  client: PublicClient,
  vault: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
): Promise<number> {
  const logs = await client.getLogs({
    address: vault,
    events: STAKE_EVENTS,
    fromBlock,
    toBlock,
  });

  const events = logs.map((log) =>
    logToEvent({
      eventName: (log as any).eventName,
      args: (log as any).args,
      blockNumber: log.blockNumber!,
      transactionHash: log.transactionHash!,
      logIndex: log.logIndex!,
    })
  );

  return insertEvents(db, events);
}
