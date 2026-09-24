import type { DecisionOutcome } from "./decision.js";

// Audit events are append-only domain records intended to explain what
// AgentShield observed and decided when durable storage is introduced.
export interface AuditEvent {
  id: string;
  actionId: string;
  agentId: string;
  eventType: string;
  decision: DecisionOutcome;
  timestamp: Date;
  metadata: Record<string, unknown>;
}
