// Actions retain tool-agnostic target and parameter data so future connectors
// can be added without coupling the domain model to a vendor API.
export interface ActionTarget {
  resource: string;
  identifier?: string;
}

export interface Action {
  id: string;
  agentId: string;
  toolId: string;
  type: string;
  target: ActionTarget;
  parameters: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
