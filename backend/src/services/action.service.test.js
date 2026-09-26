import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ActionServiceError,
  createActionService,
} from "./action.service.js";

describe("Action Service (Tool Calls Interception & Execution)", () => {
  let fakeActionRepo;
  let fakeAgentRepo;
  let fakeApprovalRepo;
  let fakeAuditRepo;
  let fakeToolRegistry;
  let actionService;

  const validAgent = {
    id: "10000000-0000-0000-0000-000000000001",
    name: "CRM Maintenance Bot",
    status: "active",
    environment: "production",
    metadata: {
      permissions: {
        allowedTools: ["customer_crm", "knowledge_base"],
        blockedOperations: [],
        environmentRestrictions: ["production", "development"],
        requiresApprovalThreshold: 60,
      },
    },
  };

  beforeEach(() => {
    fakeActionRepo = {
      actions: [],
      async createAction(act) {
        this.actions.push(act);
        return act;
      },
      async getActionById(id) {
        return this.actions.find((a) => a.id === id) || null;
      },
      async listActionsByAgentId(agentId) {
        return { items: this.actions.filter((a) => a.agentId === agentId), hasMore: false };
      },
    };

    fakeAgentRepo = {
      async getAgentById(id) {
        if (id === validAgent.id) return validAgent;
        return null;
      },
    };

    fakeApprovalRepo = {
      approvals: [],
      async createApproval(appr) {
        const item = { id: "a0000000-0000-0000-0000-000000000001", ...appr };
        this.approvals.push(item);
        return item;
      },
    };

    fakeAuditRepo = {
      events: [],
      async createAuditEvent(ev) {
        this.events.push(ev);
        return ev;
      },
    };

    fakeToolRegistry = {
      executed: [],
      async executeOperation(toolId, operation, parameters) {
        this.executed.push({ toolId, operation, parameters });
        return { success: true, processed: true };
      },
    };

    actionService = createActionService({
      actionRepository: fakeActionRepo,
      agentRepository: fakeAgentRepo,
      approvalRepository: fakeApprovalRepo,
      auditEventRepository: fakeAuditRepo,
      toolRegistry: fakeToolRegistry,
    });
  });

  describe("createAndExecuteAction", () => {
    it("intercepts and executes routine low-risk action (ALLOW -> EXECUTED)", async () => {
      const result = await actionService.createAndExecuteAction({
        agentId: validAgent.id,
        toolId: "knowledge_base",
        operation: "read_article",
        parameters: { query: "API specs" },
      });

      assert.equal(result.status, "EXECUTED");
      assert.equal(result.decision, "ALLOW");
      assert.equal(result.executed, true);
      assert.equal(result.risk.level, "LOW");
      assert.equal(result.policy.policyCode, "standard_risk_allow");
      assert.equal(fakeToolRegistry.executed.length, 1);
      assert.equal(fakeToolRegistry.executed[0].toolId, "knowledge_base");
    });

    it("intercepts and blocks critical bulk delete operations (BLOCK -> Not Executed)", async () => {
      const result = await actionService.createAndExecuteAction({
        agentId: validAgent.id,
        toolId: "customer_crm",
        operation: "delete_customers",
        parameters: { count: 147 },
      });

      assert.equal(result.status, "BLOCKED");
      assert.equal(result.decision, "BLOCK");
      assert.equal(result.executed, false);
      assert.equal(result.risk.score, 100);
      assert.equal(result.policy.policyCode, "bulk_delete_guard");
      assert.equal(fakeToolRegistry.executed.length, 0);
    });

    it("intercepts and halts high-risk action for human review (APPROVAL_REQUIRED)", async () => {
      const agentWithLedger = {
        id: "20000000-0000-0000-0000-000000000002",
        name: "Financial Bot",
        status: "active",
        metadata: { permissions: { allowedTools: ["*"] } },
      };

      fakeAgentRepo.getAgentById = async () => agentWithLedger;

      const result = await actionService.createAndExecuteAction({
        agentId: agentWithLedger.id,
        toolId: "financial_ledger",
        operation: "disburse_funds",
        parameters: { amount: 5000 },
      });

      assert.equal(result.status, "APPROVAL_REQUIRED");
      assert.equal(result.decision, "APPROVAL_REQUIRED");
      assert.equal(result.executed, false);
      assert.equal(result.policy.policyCode, "financial_guardrail");
      assert.ok(result.approval);
      assert.equal(fakeApprovalRepo.approvals.length, 1);
      assert.equal(fakeToolRegistry.executed.length, 0);
    });

    it("intercepts and blocks unauthorized tool invocation at Stage 1 Authorization", async () => {
      const result = await actionService.createAndExecuteAction({
        agentId: validAgent.id,
        toolId: "infrastructure_ops",
        operation: "restart_cluster",
        parameters: { clusterId: "prod-1" },
      });

      assert.equal(result.status, "BLOCKED");
      assert.equal(result.decision, "BLOCK");
      assert.equal(result.executed, false);
      assert.equal(result.policyCode, "TOOL_UNAUTHORIZED");
      assert.equal(fakeToolRegistry.executed.length, 0);
    });

    it("simulates governance pipeline in dry-run mode without executing tool", async () => {
      const result = await actionService.createAndExecuteAction({
        agentId: validAgent.id,
        toolId: "knowledge_base",
        operation: "read_article",
        parameters: { query: "guides" },
        dryRun: true,
      });

      assert.equal(result.status, "SIMULATED_ALLOW");
      assert.equal(result.decision, "ALLOW");
      assert.equal(result.executed, false);
      assert.equal(result.dryRun, true);
      assert.equal(fakeToolRegistry.executed.length, 0);
    });
  });

  describe("processAction & Lookup", () => {
    it("processes canonical action through interceptor", async () => {
      const actionInput = {
        agentId: validAgent.id,
        actionType: "read",
        target: "knowledge_base.read",
        description: "Read runbooks",
        environment: "production",
      };

      const result = await actionService.processAction(actionInput);
      assert.equal(result.success, true);
      assert.equal(result.decision, "ALLOW");
      assert.equal(fakeActionRepo.actions.length, 1);
    });

    it("retrieves action by ID", async () => {
      const act = {
        id: "ac000000-0000-0000-0000-000000000001",
        agentId: validAgent.id,
        actionType: "read",
        target: "knowledge_base.read",
      };
      await fakeActionRepo.createAction(act);

      const retrieved = await actionService.getActionById(act.id);
      assert.equal(retrieved.id, act.id);
    });
  });
});
