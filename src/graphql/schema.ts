export const schema = /* GraphQL */ `
  enum EventType {
    Staked
    Unstaked
    Claimed
  }

  "A single staking event indexed from the chain."
  type StakeEvent {
    id: Int!
    user: String!
    type: EventType!
    amount: String!
    blockNumber: String!
    txHash: String!
    logIndex: Int!
  }

  "Aggregated per-user totals (in wei, as strings)."
  type UserStats {
    user: String!
    totalStaked: String!
    totalUnstaked: String!
    totalClaimed: String!
  }

  type Query {
    "Recent events, newest first. Optionally filter by user and/or type."
    events(user: String, type: EventType, limit: Int): [StakeEvent!]!
    "Aggregated staked / unstaked / claimed totals for one user."
    userStats(user: String!): UserStats!
  }
`;
