// Domain types describe AgentShield concepts independently of any future
// database or transport implementation.
export type AgentStatus = "ACTIVE" | "PAUSED" | "DISABLED";

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  createdAt: Date;
}
