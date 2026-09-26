import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AuthorizationError,
  ROLE_PERMISSIONS,
  hasPermission,
  validateAgentStatus,
  authorizeAgentToolAction,
  createAuthorizationService,
  requireUserRole,
  requireUserPermission,
} from "./authorization.service.js";

describe("Authorization Service", () => {
  describe("validateAgentStatus", () => {
    it("returns valid for active agent", () => {
      const agent = { id: "123e4567-e89b-12d3-a456-426614174000", name: "Support Bot", status: "active" };
      const result = validateAgentStatus(agent);
      assert.equal(result.valid, true);
    });

    it("returns valid when status is uppercase ACTIVE or has whitespace", () => {
      const agent = { id: "123e4567-e89b-12d3-a456-426614174000", name: "Support Bot", status: " ACTIVE " };
      const result = validateAgentStatus(agent);
      assert.equal(result.valid, true);
    });

    it("fails when agent is null or not an object", () => {
      assert.equal(validateAgentStatus(null).valid, false);
      assert.equal(validateAgentStatus(null).code, "AGENT_NOT_FOUND");
      assert.equal(validateAgentStatus("agent-id").valid, false);
    });

    it("fails when agent ID is missing", () => {
      const result = validateAgentStatus({ name: "No ID", status: "active" });
      assert.equal(result.valid, false);
      assert.equal(result.code, "INVALID_AGENT_ID");
    });

    it("fails when agent status is inactive or paused", () => {
      const result = validateAgentStatus({ id: "agent-1", status: "inactive" });
      assert.equal(result.valid, false);
      assert.equal(result.code, "AGENT_INACTIVE");
      assert.match(result.reason, /Agent is not active/i);

      const paused = validateAgentStatus({ id: "agent-2", status: "paused" });
      assert.equal(paused.valid, false);
      assert.equal(paused.code, "AGENT_INACTIVE");
    });
  });

  describe("hasPermission & ROLE_PERMISSIONS", () => {
    it("admin has all administrative and operational permissions", () => {
      assert.equal(hasPermission("admin", "agents:write"), true);
      assert.equal(hasPermission("admin", "agents:delete"), true);
      assert.equal(hasPermission("admin", "tools:execute"), true);
      assert.equal(hasPermission("admin", "actions:approve"), true);
      assert.equal(hasPermission("admin", "system:manage"), true);
    });

    it("operator has execution and approval permissions but not system:manage", () => {
      assert.equal(hasPermission("operator", "tools:execute"), true);
      assert.equal(hasPermission("operator", "actions:approve"), true);
      assert.equal(hasPermission("operator", "system:manage"), false);
      assert.equal(hasPermission("operator", "agents:delete"), false);
    });

    it("reviewer has approval/rejection permissions but cannot write agents", () => {
      assert.equal(hasPermission("reviewer", "actions:approve"), true);
      assert.equal(hasPermission("reviewer", "actions:reject"), true);
      assert.equal(hasPermission("reviewer", "agents:write"), false);
    });

    it("viewer has read-only permissions", () => {
      assert.equal(hasPermission("viewer", "agents:read"), true);
      assert.equal(hasPermission("viewer", "actions:read"), true);
      assert.equal(hasPermission("viewer", "actions:approve"), false);
      assert.equal(hasPermission("viewer", "tools:execute"), false);
    });

    it("returns false for unknown role or unknown permission", () => {
      assert.equal(hasPermission("guest", "agents:read"), false);
      assert.equal(hasPermission("admin", "non_existent_permission"), false);
      assert.equal(hasPermission(null, "agents:read"), false);
      assert.equal(hasPermission("admin", null), false);
    });
  });

  describe("authorizeAgentToolAction", () => {
    const baseAgent = {
      id: "agent-123",
      name: "CRM Assistant",
      status: "active",
      environment: "production",
      metadata: {
        permissions: {
          allowedTools: ["customer_crm", "knowledge_base"],
          blockedOperations: ["bulkDeleteCustomers"],
          environmentRestrictions: ["development", "production"],
          maxFinancialLimit: 1000,
        },
      },
    };

    it("authorizes allowed tool and operation", () => {
      const result = authorizeAgentToolAction(baseAgent, {
        toolId: "customer_crm",
        operation: "listCustomers",
        parameters: { limit: 10 },
      });
      assert.equal(result.authorized, true);
      assert.equal(result.agentId, "agent-123");
    });

    it("allows any tool when allowedTools is ['*']", () => {
      const wildcardAgent = {
        id: "agent-wildcard",
        status: "active",
        metadata: { permissions: { allowedTools: ["*"] } },
      };
      const result = authorizeAgentToolAction(wildcardAgent, {
        toolId: "financial_ledger",
        operation: "viewBalance",
      });
      assert.equal(result.authorized, true);
    });

    it("rejects unauthorized tool", () => {
      const result = authorizeAgentToolAction(baseAgent, {
        toolId: "financial_ledger",
        operation: "createTransaction",
      });
      assert.equal(result.authorized, false);
      assert.equal(result.code, "TOOL_UNAUTHORIZED");
      assert.match(result.reason, /not authorized to invoke tool/i);
    });

    it("rejects explicitly blocked operation", () => {
      const result = authorizeAgentToolAction(baseAgent, {
        toolId: "customer_crm",
        operation: "bulkDeleteCustomers",
        parameters: { count: 50 },
      });
      assert.equal(result.authorized, false);
      assert.equal(result.code, "OPERATION_BLOCKED_BY_PERMISSIONS");
      assert.match(result.reason, /explicitly restricted/i);
    });

    it("rejects environment outside allowed restrictions", () => {
      const result = authorizeAgentToolAction(baseAgent, {
        toolId: "customer_crm",
        operation: "listCustomers",
        environment: "staging",
      });
      assert.equal(result.authorized, false);
      assert.equal(result.code, "ENVIRONMENT_UNAUTHORIZED");
      assert.match(result.reason, /not authorized to execute actions in environment 'staging'/i);
    });

    it("enforces financial parameter limit", () => {
      const allowedResult = authorizeAgentToolAction(baseAgent, {
        toolId: "customer_crm",
        operation: "createCustomer",
        parameters: { amount: 500 },
      });
      assert.equal(allowedResult.authorized, true);

      const exceededResult = authorizeAgentToolAction(baseAgent, {
        toolId: "customer_crm",
        operation: "createCustomer",
        parameters: { amount: 1500 },
      });
      assert.equal(exceededResult.authorized, false);
      assert.equal(exceededResult.code, "FINANCIAL_LIMIT_EXCEEDED");
    });

    it("rejects missing toolId or operation", () => {
      const noTool = authorizeAgentToolAction(baseAgent, { operation: "list" });
      assert.equal(noTool.authorized, false);
      assert.equal(noTool.code, "INVALID_TOOL_ID");

      const noOp = authorizeAgentToolAction(baseAgent, { toolId: "customer_crm" });
      assert.equal(noOp.authorized, false);
      assert.equal(noOp.code, "INVALID_OPERATION");
    });

    it("rejects inactive agent regardless of action parameters", () => {
      const inactiveAgent = { ...baseAgent, status: "inactive" };
      const result = authorizeAgentToolAction(inactiveAgent, {
        toolId: "customer_crm",
        operation: "listCustomers",
      });
      assert.equal(result.authorized, false);
      assert.equal(result.code, "AGENT_INACTIVE");
    });
  });

  describe("createAuthorizationService", () => {
    const mockRepo = {
      agents: new Map([
        ["agent-uuid-1", { id: "agent-uuid-1", status: "active", metadata: { permissions: { allowedTools: ["*"] } } }],
        ["agent-uuid-2", { id: "agent-uuid-2", status: "inactive" }],
      ]),
      async getAgentById(id) {
        return this.agents.get(id) || null;
      },
    };

    const service = createAuthorizationService({ agentRepository: mockRepo });

    it("resolves agent by UUID asynchronously from repository and authorizes", async () => {
      const result = await service.authorizeAgentAction("agent-uuid-1", {
        toolId: "knowledge_base",
        operation: "queryDocuments",
      });
      assert.equal(result.authorized, true);
      assert.equal(result.agentId, "agent-uuid-1");
    });

    it("returns AGENT_NOT_FOUND if UUID does not exist in repository", async () => {
      const result = await service.authorizeAgentAction("unknown-uuid", {
        toolId: "knowledge_base",
        operation: "queryDocuments",
      });
      assert.equal(result.authorized, false);
      assert.equal(result.code, "AGENT_NOT_FOUND");
    });

    it("returns AGENT_INACTIVE for inactive agent resolved from repository", async () => {
      const result = await service.authorizeAgentAction("agent-uuid-2", {
        toolId: "knowledge_base",
        operation: "queryDocuments",
      });
      assert.equal(result.authorized, false);
      assert.equal(result.code, "AGENT_INACTIVE");
    });

    it("supports direct agent object passed to service", async () => {
      const result = await service.authorizeAgentAction(
        { id: "direct-agent", status: "active", metadata: { permissions: { allowedTools: ["*"] } } },
        { toolId: "email_sender", operation: "sendTransactionalEmail" }
      );
      assert.equal(result.authorized, true);
    });

    it("authorizes user permissions via authorizeUser", () => {
      const adminUser = { id: "u-1", role: "admin", email: "admin@example.com" };
      const viewerUser = { id: "u-2", role: "viewer", email: "viewer@example.com" };

      assert.equal(service.authorizeUser(adminUser, "actions:approve"), true);
      assert.equal(service.authorizeUser(viewerUser, "actions:approve"), false);
      assert.equal(service.authorizeUser(viewerUser, "actions:read"), true);
    });

    it("checks role membership via hasAnyRole", () => {
      const operatorUser = { id: "u-3", role: "operator" };
      assert.equal(service.hasAnyRole(operatorUser, ["admin", "operator"]), true);
      assert.equal(service.hasAnyRole(operatorUser, ["admin"]), false);
    });
  });

  describe("Express Middleware Helpers", () => {
    it("requireUserRole calls next() for authorized role", () => {
      const middleware = requireUserRole("admin", "operator");
      const req = { user: { role: "admin" } };
      let calledNext = false;
      const res = {
        status() { return this; },
        json() { return this; },
      };

      middleware(req, res, () => { calledNext = true; });
      assert.equal(calledNext, true);
    });

    it("requireUserRole returns 401 when req.user is absent", () => {
      const middleware = requireUserRole("admin");
      const req = {};
      let statusCode = 0;
      let responseBody = null;
      const res = {
        status(code) { statusCode = code; return this; },
        json(body) { responseBody = body; return this; },
      };

      middleware(req, res, () => {});
      assert.equal(statusCode, 401);
      assert.equal(responseBody.error.code, "UNAUTHORIZED");
    });

    it("requireUserRole returns 403 when user lacks required role", () => {
      const middleware = requireUserRole("admin");
      const req = { user: { role: "viewer" } };
      let statusCode = 0;
      let responseBody = null;
      const res = {
        status(code) { statusCode = code; return this; },
        json(body) { responseBody = body; return this; },
      };

      middleware(req, res, () => {});
      assert.equal(statusCode, 403);
      assert.equal(responseBody.error.code, "FORBIDDEN");
    });

    it("requireUserPermission allows authorized permission and blocks unauthorized", () => {
      const middleware = requireUserPermission("actions:approve");
      
      let nextCalled = false;
      middleware({ user: { role: "reviewer" } }, {}, () => { nextCalled = true; });
      assert.equal(nextCalled, true);

      let statusCode = 0;
      const res = {
        status(code) { statusCode = code; return this; },
        json() { return this; },
      };
      middleware({ user: { role: "viewer" } }, res, () => {});
      assert.equal(statusCode, 403);
    });
  });
});
