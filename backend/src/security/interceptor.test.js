import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SecurityInterceptor,
  SecurityInterceptorError,
  createSecurityInterceptor,
} from "./interceptor.js";

describe("Security Interceptor (Authorization -> Risk -> Policy)", () => {
  const interceptor = createSecurityInterceptor();

  const activeAgent = {
    id: "10000000-0000-0000-0000-000000000001",
    name: "CRM Maintenance Bot",
    status: "active",
    environment: "production",
    metadata: {
      permissions: {
        allowedTools: ["customer_crm", "knowledge_base"],
        blockedOperations: ["purge_all"],
        environmentRestrictions: ["production", "development"],
        requiresApprovalThreshold: 60,
      },
    },
  };

  const inactiveAgent = {
    id: "90000000-0000-0000-0000-000000000009",
    name: "Decommissioned Agent",
    status: "inactive",
    metadata: {
      permissions: {
        allowedTools: ["*"],
      },
    },
  };

  describe("Stage 1: Authorization Gate", () => {
    it("blocks inactive agent immediately during authorization stage", async () => {
      const outcome = await interceptor.interceptToolAction({
        agent: inactiveAgent,
        toolId: "customer_crm",
        operation: "get_customer",
        parameters: { customerId: "CUST-100" },
      });

      assert.equal(outcome.status, "BLOCKED");
      assert.equal(outcome.decision, "BLOCK");
      assert.equal(outcome.authorized, false);
      assert.equal(outcome.policyCode, "AGENT_INACTIVE");
      assert.equal(outcome.pipeline.authorization, false);
      assert.equal(outcome.pipeline.riskEvaluated, false);
      assert.equal(outcome.pipeline.policyApplied, false);
    });

    it("blocks tool invocation when tool is not in agent allowedTools", async () => {
      const outcome = await interceptor.interceptToolAction({
        agent: activeAgent,
        toolId: "infrastructure_ops",
        operation: "restart_cluster",
        parameters: { clusterId: "k8s-prod" },
      });

      assert.equal(outcome.status, "BLOCKED");
      assert.equal(outcome.decision, "BLOCK");
      assert.equal(outcome.authorized, false);
      assert.equal(outcome.policyCode, "TOOL_UNAUTHORIZED");
      assert.ok(outcome.reason.includes("not authorized to invoke tool"));
    });

    it("blocks explicitly blocked operations", async () => {
      const outcome = await interceptor.interceptToolAction({
        agent: activeAgent,
        toolId: "customer_crm",
        operation: "purge_all",
      });

      assert.equal(outcome.status, "BLOCKED");
      assert.equal(outcome.authorized, false);
      assert.ok(outcome.policyCode.includes("OPERATION_BLOCKED"));
    });
  });

  describe("Stage 2 & 3: Risk Evaluation & Policy Determination", () => {
    it("allows routine low-risk actions under standard_risk_allow", async () => {
      const outcome = await interceptor.interceptToolAction({
        agent: activeAgent,
        toolId: "knowledge_base",
        operation: "read_article",
        parameters: { query: "billing guide" },
      });

      assert.equal(outcome.status, "ALLOWED");
      assert.equal(outcome.decision, "ALLOW");
      assert.equal(outcome.authorized, true);
      assert.equal(outcome.risk.level, "LOW");
      assert.equal(outcome.policy.policyCode, "standard_risk_allow");
      assert.equal(outcome.policy.requiresHumanApproval, false);
      assert.ok(outcome.audit);
    });

    it("blocks critical bulk delete operations under bulk_delete_guard", async () => {
      const outcome = await interceptor.interceptToolAction({
        agent: activeAgent,
        toolId: "customer_crm",
        operation: "delete_customers",
        parameters: { count: 150 },
      });

      assert.equal(outcome.status, "BLOCK");
      assert.equal(outcome.decision, "BLOCK");
      assert.equal(outcome.risk.score, 100);
      assert.equal(outcome.risk.level, "CRITICAL");
      assert.equal(outcome.policy.policyCode, "bulk_delete_guard");
      assert.equal(outcome.policy.requiresHumanApproval, false);
    });

    it("enforces agent_threshold_guard when risk score reaches agent threshold", async () => {
      const customAgentWithThreshold = {
        ...activeAgent,
        metadata: {
          permissions: {
            allowedTools: ["*"],
            requiresApprovalThreshold: 30,
          },
        },
      };

      const outcome = await interceptor.interceptToolAction({
        agent: customAgentWithThreshold,
        toolId: "customer_crm",
        operation: "update_customer",
        parameters: { count: 25 },
      });

      assert.equal(outcome.status, "APPROVAL_REQUIRED");
      assert.equal(outcome.decision, "APPROVAL_REQUIRED");
      assert.equal(outcome.policy.policyCode, "agent_threshold_guard");
      assert.equal(outcome.policy.requiresHumanApproval, true);
    });

    it("enforces financial_guardrail when transaction amount >= $1,000", async () => {
      const agentWithLedger = {
        ...activeAgent,
        metadata: {
          permissions: {
            allowedTools: ["*"],
          },
        },
      };

      const outcome = await interceptor.interceptToolAction({
        agent: agentWithLedger,
        toolId: "financial_ledger",
        operation: "disburse_funds",
        parameters: { amount: 5000 },
      });

      assert.equal(outcome.status, "APPROVAL_REQUIRED");
      assert.equal(outcome.decision, "APPROVAL_REQUIRED");
      assert.equal(outcome.policy.policyCode, "financial_guardrail");
      assert.equal(outcome.policy.requiresHumanApproval, true);
    });
  });

  describe("Custom Agent Policies & Error Handling", () => {
    it("supports custom agent policy overrides in the pipeline", async () => {
      const customPolicies = [
        {
          code: "knowledge_read_review",
          name: "Knowledge Base Review Rule",
          decision: "APPROVAL_REQUIRED",
          reason: "Knowledge base queries require human verification",
          match: (act) => act.target === "knowledge_base.read_article",
        },
      ];

      const outcome = await interceptor.interceptToolAction({
        agent: activeAgent,
        toolId: "knowledge_base",
        operation: "read_article",
        environment: "production",
        customPolicies,
      });

      assert.equal(outcome.decision, "APPROVAL_REQUIRED");
      assert.equal(outcome.policy.policyCode, "knowledge_read_review");
    });

    it("throws SecurityInterceptorError on invalid arguments", async () => {
      await assert.rejects(
        () => interceptor.interceptToolAction({ toolId: null, operation: "read" }),
        (err) => err instanceof SecurityInterceptorError && err.statusCode === 400
      );
    });
  });
});
