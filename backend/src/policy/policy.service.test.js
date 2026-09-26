import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PolicyServiceError,
  SYSTEM_POLICIES,
  createPolicyService,
} from "./policy.service.js";

describe("Policy Service", () => {
  const policyService = createPolicyService();

  describe("Policy Registry & Lookup", () => {
    it("lists all registered system baseline policies", () => {
      const policies = policyService.listPolicies();
      assert.ok(Array.isArray(policies));
      assert.ok(policies.length >= 6);

      const codes = policies.map((p) => p.code);
      assert.ok(codes.includes("bulk_delete_guard"));
      assert.ok(codes.includes("critical_risk_block"));
      assert.ok(codes.includes("external_email_review"));
      assert.ok(codes.includes("standard_risk_allow"));
    });

    it("finds a specific policy by code", () => {
      const policy = policyService.getPolicyByCode("bulk_delete_guard");
      assert.ok(policy);
      assert.equal(policy.decision, "BLOCK");
      assert.equal(policy.requiresHumanApproval, false);
      assert.equal(policy.name, "Bulk Deletion Guardrail");
    });

    it("returns null for non-existent policy code", () => {
      assert.equal(policyService.getPolicyByCode("unknown_rule"), null);
      assert.equal(policyService.getPolicyByCode(null), null);
    });
  });

  describe("evaluatePolicy", () => {
    it("evaluates bulk_delete_guard for destructive delete of 147 customers", () => {
      const action = {
        actionType: "delete",
        scope: { count: 147 },
        destination: { type: "internal" },
      };
      const risk = { score: 100, level: "CRITICAL", factors: [] };

      const result = policyService.evaluatePolicy(action, risk);
      assert.equal(result.decision, "BLOCK");
      assert.equal(result.policyCode, "bulk_delete_guard");
      assert.equal(result.requiresHumanApproval, false);
      assert.ok(result.timestamp);
    });

    it("evaluates external_email_review for outbound HIGH risk email", () => {
      const action = {
        actionType: "send",
        destination: { type: "external" },
        scope: { count: 38 },
      };
      const risk = { score: 65, level: "HIGH", factors: [] };

      const result = policyService.evaluatePolicy(action, risk);
      assert.equal(result.decision, "APPROVAL_REQUIRED");
      assert.equal(result.policyCode, "external_email_review");
      assert.equal(result.requiresHumanApproval, true);
    });

    it("evaluates standard_risk_allow for safe internal reads", () => {
      const action = {
        actionType: "read",
        destination: { type: "internal" },
        scope: { count: 1 },
      };
      const risk = { score: 0, level: "LOW", factors: [] };

      const result = policyService.evaluatePolicy(action, risk);
      assert.equal(result.decision, "ALLOW");
      assert.equal(result.policyCode, "standard_risk_allow");
      assert.equal(result.requiresHumanApproval, false);
    });

    it("supports custom agent policy override", () => {
      const customPolicies = [
        {
          code: "staging_finance_block",
          name: "Staging Financial Block",
          decision: "BLOCK",
          reason: "Financial transactions blocked on staging",
          match: (act) => act.environment === "staging" && act.tool === "financial_ledger",
        },
      ];

      const action = {
        tool: "financial_ledger",
        environment: "staging",
        actionType: "write",
      };
      const risk = { score: 20, level: "LOW", factors: [] };

      const result = policyService.evaluatePolicy(action, risk, customPolicies);
      assert.equal(result.decision, "BLOCK");
      assert.equal(result.policyCode, "staging_finance_block");
      assert.equal(result.policyName, "Staging Financial Block");
    });

    it("throws PolicyServiceError on missing or invalid input", () => {
      assert.throws(
        () => policyService.evaluatePolicy(null, { level: "LOW" }),
        (err) => err instanceof PolicyServiceError && err.statusCode === 400
      );

      assert.throws(
        () => policyService.evaluatePolicy({}, null),
        (err) => err instanceof PolicyServiceError && err.statusCode === 400
      );
    });
  });
});
