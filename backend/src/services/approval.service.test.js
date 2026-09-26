import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ApprovalServiceError,
  createApprovalService,
} from "./approval.service.js";

describe("Approval Service (Human-in-the-Loop)", () => {
  let fakeApprovalRepo;
  let fakeActionRepo;
  let fakeAuditRepo;
  let fakeToolRegistry;
  let approvalService;

  const samplePendingApproval = {
    id: "a0000000-0000-0000-0000-000000000001",
    action_id: "ac000000-0000-0000-0000-000000000001",
    decision_id: "dc000000-0000-0000-0000-000000000001",
    status: "pending",
    reviewer: null,
    reason: null,
    metadata: {
      toolId: "email_sender",
      operation: "bulk_send_emails",
      parameters: { recipientCount: 38 },
    },
    created_at: new Date().toISOString(),
  };

  const sampleAction = {
    id: "ac000000-0000-0000-0000-000000000001",
    agent_id: "10000000-0000-0000-0000-000000000001",
    tool: "email_sender",
    target: "email_sender.bulk_send_emails",
    action_type: "send",
    parameters: { recipientCount: 38 },
  };

  beforeEach(() => {
    fakeApprovalRepo = {
      items: [JSON.parse(JSON.stringify(samplePendingApproval))],
      async listApprovals({ status }) {
        const filtered = status ? this.items.filter((i) => i.status === status) : this.items;
        return { items: filtered, hasMore: false };
      },
      async getApprovalById(id) {
        return this.items.find((i) => i.id === id) || null;
      },
      async createApproval(payload) {
        const newItem = {
          id: payload.id || "a0000000-0000-0000-0000-000000000002",
          action_id: payload.actionId,
          decision_id: payload.decisionId || null,
          status: payload.status || "pending",
          reviewer: null,
          reason: payload.reason || null,
          metadata: payload.metadata || {},
          created_at: new Date().toISOString(),
        };
        this.items.push(newItem);
        return newItem;
      },
      async resolveApproval(id, { status, reviewer, reason }) {
        const item = this.items.find((i) => i.id === id);
        if (!item) throw new Error("Approval record not found");
        item.status = status;
        item.reviewer = reviewer;
        item.reason = reason;
        item.resolved_at = new Date().toISOString();
        return item;
      },
    };

    fakeActionRepo = {
      actions: [sampleAction],
      async getActionById(id) {
        return this.actions.find((a) => a.id === id) || null;
      },
    };

    fakeAuditRepo = {
      events: [],
      async createAuditEvent(event) {
        this.events.push(event);
        return event;
      },
    };

    fakeToolRegistry = {
      executed: [],
      async executeOperation(toolId, operation, parameters) {
        this.executed.push({ toolId, operation, parameters });
        return { success: true, dispatched: true };
      },
    };

    approvalService = createApprovalService({
      approvalRepository: fakeApprovalRepo,
      actionRepository: fakeActionRepo,
      auditEventRepository: fakeAuditRepo,
      toolRegistry: fakeToolRegistry,
    });
  });

  describe("listApprovals", () => {
    it("lists all approvals with default pagination", async () => {
      const result = await approvalService.listApprovals();
      assert.ok(Array.isArray(result.approvals));
      assert.equal(result.approvals.length, 1);
      assert.equal(result.pagination.page, 1);
      assert.equal(result.pagination.limit, 20);
    });

    it("filters approvals by status", async () => {
      const pending = await approvalService.listApprovals({ status: "pending" });
      assert.equal(pending.approvals.length, 1);

      const approved = await approvalService.listApprovals({ status: "approved" });
      assert.equal(approved.approvals.length, 0);
    });
  });

  describe("getApprovalById", () => {
    it("retrieves approval record enriched with action data", async () => {
      const result = await approvalService.getApprovalById(samplePendingApproval.id);
      assert.ok(result.approval);
      assert.equal(result.approval.id, samplePendingApproval.id);
      assert.ok(result.action);
      assert.equal(result.action.id, sampleAction.id);
    });

    it("throws 400 for invalid UUID", async () => {
      await assert.rejects(
        () => approvalService.getApprovalById("not-a-uuid"),
        (err) => err instanceof ApprovalServiceError && err.statusCode === 400
      );
    });

    it("throws 404 for non-existent approval record", async () => {
      await assert.rejects(
        () => approvalService.getApprovalById("00000000-0000-0000-0000-000000000099"),
        (err) => err instanceof ApprovalServiceError && err.statusCode === 404
      );
    });
  });

  describe("createPendingApproval", () => {
    it("creates pending approval and records awaiting approval audit event", async () => {
      const created = await approvalService.createPendingApproval({
        actionId: "ac000000-0000-0000-0000-000000000002",
        reason: "Mass email requires human authorization",
      });

      assert.ok(created);
      assert.equal(created.status, "pending");
      assert.equal(fakeAuditRepo.events.length, 1);
      assert.equal(fakeAuditRepo.events[0].status, "AWAITING_APPROVAL");
    });
  });

  describe("approveAction", () => {
    it("approves pending action, resumes tool execution, and records audit event", async () => {
      const result = await approvalService.approveAction(samplePendingApproval.id, {
        reviewer: "security_admin@enterprise.com",
        notes: "Approved after verifying recipient list",
      });

      assert.ok(result.approval);
      assert.equal(result.approval.status, "approved");
      assert.equal(result.approval.reviewer, "security_admin@enterprise.com");
      assert.ok(result.execution);
      assert.equal(result.execution.success, true);

      // Verify tool execution
      assert.equal(fakeToolRegistry.executed.length, 1);
      assert.equal(fakeToolRegistry.executed[0].toolId, "email_sender");

      // Verify audit event
      assert.equal(fakeAuditRepo.events.length, 1);
      assert.equal(fakeAuditRepo.events[0].status, "APPROVED_AND_EXECUTED");
    });

    it("throws 409 conflict when approval is already resolved", async () => {
      await approvalService.approveAction(samplePendingApproval.id);

      await assert.rejects(
        () => approvalService.approveAction(samplePendingApproval.id),
        (err) => err instanceof ApprovalServiceError && err.statusCode === 409
      );
    });
  });

  describe("rejectAction", () => {
    it("rejects pending action, halts tool execution, and records rejection audit event", async () => {
      const result = await approvalService.rejectAction(samplePendingApproval.id, {
        reviewer: "security_admin@enterprise.com",
        reason: "Unverified external destination",
      });

      assert.ok(result.approval);
      assert.equal(result.approval.status, "rejected");
      assert.equal(result.approval.reviewer, "security_admin@enterprise.com");

      // No tool executed
      assert.equal(fakeToolRegistry.executed.length, 0);

      // Verify audit event
      assert.equal(fakeAuditRepo.events.length, 1);
      assert.equal(fakeAuditRepo.events[0].status, "REJECTED_BY_HUMAN");
      assert.equal(fakeAuditRepo.events[0].decision, "BLOCK");
    });
  });
});
