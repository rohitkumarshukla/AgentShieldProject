// Decision represents AgentShield's authorization outcome. The decision-making
// logic that produces it will be implemented independently later.
export type DecisionOutcome = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export interface Decision {
  outcome: DecisionOutcome;
  reason: string;
  riskScore: number;
  policyId?: string;
  timestamp: Date;
}
