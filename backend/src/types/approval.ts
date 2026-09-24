export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

// Approval captures the lifecycle of a human decision without prescribing how
// notifications, identity, or persistence will work.
export interface Approval {
  id: string;
  actionId: string;
  status: ApprovalStatus;
  requestedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}
