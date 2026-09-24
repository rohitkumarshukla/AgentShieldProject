import type { DecisionOutcome } from "./decision.js";

// Policies are declarative domain records. Their interpretation belongs to the
// future policy engine, keeping persistence and evaluation concerns separate.
export interface Policy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: Record<string, unknown>;
  action: DecisionOutcome;
}
