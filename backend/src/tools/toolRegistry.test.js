import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./toolRegistry.js";
import { GovernedToolExecutor } from "./governedToolExecutor.js";

describe("ToolRegistry & Mock Tools", () => {
  it("initializes with default mock enterprise tools", () => {
    const registry = new ToolRegistry();
    const tools = registry.listTools();

    assert.ok(tools.length >= 6);
    const crm = registry.getTool("customer_crm");
    assert.ok(crm);
    assert.equal(crm.name, "Customer CRM");
    assert.ok(crm.operations.some((op) => op.name === "delete_customers"));
  });

  it("finds specific operations on registered tools", () => {
    const registry = new ToolRegistry();
    const opInfo = registry.getOperation("customer_crm", "delete_customers");

    assert.ok(opInfo);
    assert.equal(opInfo.tool.id, "customer_crm");
    assert.equal(opInfo.operation.name, "delete_customers");
    assert.equal(opInfo.operation.actionType, "delete");
    assert.equal(opInfo.operation.defaultRisk, "CRITICAL");
  });

  it("returns null for non-existent tools or operations", () => {
    const registry = new ToolRegistry();
    assert.equal(registry.getTool("non_existent_tool"), null);
    assert.equal(registry.getOperation("customer_crm", "non_existent_op"), null);
  });

  it("executes mock tool operations safely and measures execution time", async () => {
    const registry = new ToolRegistry();
    const res = await registry.executeOperation("customer_crm", "get_customer", { customerId: "cust_77" });

    assert.equal(res.success, true);
    assert.equal(res.toolId, "customer_crm");
    assert.equal(res.operation, "get_customer");
    assert.equal(res.result.customer.id, "cust_77");
    assert.equal(typeof res.executionTimeMs, "number");
  });

  it("executes knowledge base read operation", async () => {
    const registry = new ToolRegistry();
    const res = await registry.executeOperation("knowledge_base", "read_articles", { count: 2 });

    assert.equal(res.success, true);
    assert.equal(res.result.articlesRead, 2);
  });

  it("supports dynamic custom tool registration", () => {
    const registry = new ToolRegistry([]);
    registry.registerTool({
      id: "slack_bot",
      name: "Slack Gateway",
      operations: [
        {
          name: "post_message",
          actionType: "send",
          async handler(params) {
            return { posted: true, channel: params.channel };
          },
        },
      ],
    });

    const tool = registry.getTool("slack_bot");
    assert.ok(tool);
    assert.equal(tool.name, "Slack Gateway");
  });
});

describe("GovernedToolExecutor", () => {
  it("allows and executes low-risk tool operations (e.g. knowledgeBase.read)", async () => {
    const executor = new GovernedToolExecutor();
    const result = await executor.invokeGovernedTool({
      agentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      toolId: "knowledge_base",
      operation: "read_articles",
      parameters: { count: 12 },
    });

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.executed, true);
    assert.equal(result.status, "EXECUTED");
    assert.ok(result.execution.success);
  });

  it("blocks critical destructive tool operations (e.g. deleteCustomers 147)", async () => {
    const executor = new GovernedToolExecutor();
    const result = await executor.invokeGovernedTool({
      agentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      toolId: "customer_crm",
      operation: "delete_customers",
      parameters: { count: 147 },
    });

    assert.equal(result.decision, "BLOCK");
    assert.equal(result.executed, false);
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.policy.policyCode, "bulk_delete_guard");
    assert.equal(result.suppressedImpact.scopeCount, 147);
  });

  it("requires approval for high-risk external operations (e.g. sendEmails 38)", async () => {
    const executor = new GovernedToolExecutor();
    const result = await executor.invokeGovernedTool({
      agentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      toolId: "email_sender",
      operation: "send_emails",
      parameters: { count: 38 },
    });

    assert.equal(result.decision, "APPROVAL_REQUIRED");
    assert.equal(result.executed, false);
    assert.equal(result.status, "APPROVAL_REQUIRED");
    assert.equal(result.policy.policyCode, "external_email_review");
  });

  it("enforces agent permission restrictions when configured", async () => {
    const mockAgent = {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      name: "Restricted Bot",
      status: "active",
      metadata: {
        permissions: {
          allowedTools: ["knowledge_base"], // Only knowledge base allowed
          blockedOperations: ["delete_customers"],
        },
      },
    };

    const fakeAgentRepo = {
      async getAgentById(id) {
        return id === mockAgent.id ? mockAgent : null;
      },
    };

    const executor = new GovernedToolExecutor({ agentRepository: fakeAgentRepo });
    const result = await executor.invokeGovernedTool({
      agentId: mockAgent.id,
      toolId: "customer_crm",
      operation: "get_customer",
    });

    assert.equal(result.status, "BLOCKED");
    assert.equal(result.decision, "BLOCK");
    assert.match(result.reason, /not authorized to (access|invoke) tool/i);
  });
});
