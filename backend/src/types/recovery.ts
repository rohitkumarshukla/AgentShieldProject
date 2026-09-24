export type RecoveryStatus = "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED";

// Recovery metadata describes a possible rollback without implementing the
// execution mechanism that a future tool connector will provide.
export interface Recovery {
  id: string;
  actionId: string;
  recoverable: boolean;
  status: RecoveryStatus;
  rollback: Record<string, unknown>;
  createdAt: Date;
}
