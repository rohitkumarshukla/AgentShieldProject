import assert from "node:assert/strict";
import test from "node:test";

import { DecisionEngine } from "./decisionEngine.js";
import { createAction } from "../domain/action.js";

const engine = new DecisionEngine();

test("TEST 1: LOW-risk internal read", () => {
  const action = createAction({
    agentId: "agent-kb",
    actionType: "read",
    target: "knowledge_base",
    description: "Read documentation",
  });

  const result = engine.evaluate(action);

  assert.equal(result.risk.level, "LOW");
  assert.equal(result.risk.score, 0);
  assert.equal(result.policy.decision, "ALLOW");
  assert.equal(result.policy.policyCode, "standard_risk_allow");
  assert.equal(result.policy.requiresHumanApproval, false);
});

test("TEST 2: HIGH-risk generic action", () => {
  // Action with 50+ risk points: write in production (15) + sensitive (20) + bulk 10 (20) = 55 (HIGH)
  const action = createAction({
    agentId: "agent-ops",
    actionType: "write",
    target: "users.profiles",
    description: "Update multiple user records",
    scope: { type: "bulk", count: 10 },
    environment: "production",
    sensitivity: { level: "sensitive" },
  });

  const result = engine.evaluate(action);

  assert.equal(result.risk.level, "HIGH");
  assert.equal(result.policy.decision, "APPROVAL_REQUIRED");
  assert.equal(result.policy.policyCode, "high_risk_human_approval");
  assert.equal(result.policy.requiresHumanApproval, true);
});

test("TEST 3: CRITICAL-risk generic action", () => {
  // Action with 80+ risk: write (0) + bulk 100+ (55) + sensitive (20) + production (15) = 90 (CRITICAL)
  const action = createAction({
    agentId: "agent-ops",
    actionType: "write",
    target: "billing.accounts",
    description: "Mass update sensitive accounts in production",
    scope: { type: "bulk", count: 120 },
    environment: "production",
    sensitivity: { level: "sensitive" },
  });

  const result = engine.evaluate(action);

  assert.equal(result.risk.level, "CRITICAL");
  assert.equal(result.policy.decision, "BLOCK");
  assert.equal(result.policy.policyCode, "critical_risk_block");
  assert.equal(result.policy.requiresHumanApproval, false);
});

test("TEST 4: Bulk delete 147", () => {
  // Destructive bulk delete: delete (50) + bulk 147 (55) = 105 -> 100 (CRITICAL)
  const action = createAction({
    agentId: "agent-cleanup",
    actionType: "delete",
    target: "crm.customers",
    description: "Delete 147 CRM customers",
    scope: { type: "bulk", count: 147 },
  });

  const result = engine.evaluate(action);

  assert.equal(result.risk.score, 100);
  assert.equal(result.risk.level, "CRITICAL");
  assert.equal(result.policy.decision, "BLOCK");
  assert.equal(result.policy.policyCode, "bulk_delete_guard");
  assert.equal(result.policy.requiresHumanApproval, false);
});

test("TEST 5: External high-risk send", () => {
  // send + external (20) + bulk 25 (35) = 55 (HIGH) -> triggers external_email_review
  const action = createAction({
    agentId: "agent-marketing",
    actionType: "send",
    target: "crm.leads",
    description: "Send campaign emails to external leads",
    scope: { type: "bulk", count: 25 },
    destination: { type: "external", value: "leads@example.com" },
  });

  const result = engine.evaluate(action);

  assert.equal(result.risk.level, "HIGH");
  assert.equal(result.policy.decision, "APPROVAL_REQUIRED");
  assert.equal(result.policy.policyCode, "external_email_review");
  assert.equal(result.policy.requiresHumanApproval, true);
});

test("TEST 6: Financial high-risk action", () => {
  // execute + financial impact ₹50,000 (35) + production (15) = 50 (HIGH)
  const action = createAction({
    agentId: "agent-finance",
    actionType: "execute",
    target: "payouts.process",
    description: "Issue contractor payout",
    environment: "production",
    financialImpact: 50000,
  });

  const result = engine.evaluate(action);

  assert.equal(result.risk.score, 50);
  assert.equal(result.risk.level, "HIGH");
  assert.equal(result.policy.decision, "APPROVAL_REQUIRED");
  assert.equal(result.policy.policyCode, "high_risk_human_approval");
});

test("TEST 7: Sensitive production action", () => {
  // read + sensitive (20) + production (15) = 35 (MEDIUM)
  const action = createAction({
    agentId: "agent-audit",
    actionType: "read",
    target: "users.pii",
    description: "Audit customer PII",
    environment: "production",
    sensitivity: { level: "sensitive" },
  });

  const result = engine.evaluate(action);

  assert.equal(result.risk.score, 35);
  assert.equal(result.risk.level, "MEDIUM");

  const factorCodes = result.risk.factors.map((f) => f.code);
  assert.ok(factorCodes.includes("SENSITIVE_DATA"));
  assert.ok(factorCodes.includes("PRODUCTION_ENVIRONMENT"));

  assert.equal(result.policy.decision, "ALLOW");
  assert.equal(result.policy.policyCode, "standard_risk_allow");
});

test("TEST 8: Original action is not mutated", () => {
  const action = createAction({
    agentId: "agent-safe",
    actionType: "read",
    target: "data.analytics",
    description: "Read metrics",
    metadata: { key: "value" },
  });

  const snapshot = JSON.stringify(action);

  const result = engine.evaluate(action);

  assert.equal(JSON.stringify(action), snapshot);
  assert.equal(result.action, action);
});

test("TEST 9: Determinism", () => {
  const action = createAction({
    agentId: "agent-det",
    actionType: "delete",
    target: "crm.customers",
    description: "Delete CRM customers",
    scope: { type: "bulk", count: 147 },
    environment: "production",
    financialImpact: 1000,
  });

  const result1 = engine.evaluate(action);
  const result2 = engine.evaluate(action);

  assert.deepEqual(result1.risk, result2.risk);
  assert.deepEqual(result1.policy, result2.policy);
});

test("TEST 10: Invalid input / fail closed", () => {
  // Null
  assert.throws(
    () => engine.evaluate(null),
    {
      name: "Error",
      message: /DecisionEngine\.evaluate requires a valid action object/,
    },
  );

  // Undefined
  assert.throws(
    () => engine.evaluate(undefined),
    {
      name: "Error",
      message: /DecisionEngine\.evaluate requires a valid action object/,
    },
  );

  // Invalid action object
  assert.throws(
    () => engine.evaluate({ invalidField: "invalid" }),
    {
      name: "Error",
    },
  );

  // Verifying that failure does NOT silently yield an ALLOW result
  let producedResult = null;
  try {
    producedResult = engine.evaluate(null);
  } catch {
    // Expected to catch
  }
  assert.equal(producedResult, null);
});
