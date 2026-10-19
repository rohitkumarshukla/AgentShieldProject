import test from "node:test";
import assert from "node:assert/strict";
import { createAction } from "../src/domain/action.js";
import { evaluateAction, DECISIONS, POLICY_IDS } from "../src/decision/decisionEngine.js";

// Helper to quickly build standard normalized actions
function makeAction(overrides = {}) {
  return createAction({
    agentId: "agent-decision-test",
    toolId: "test_tool",
    operation: "test_operation",
    ...overrides,
  });
}

test("evaluateAction - Scenario A (Bulk deletion): blocks delete_customers with count 147 via bulk_delete_guard", () => {
  const action = makeAction({
    agentId: "crm-cleanup-agent",
    toolId: "CRM.deleteCustomers",
    operation: "delete_customers",
    parameters: { count: 147 },
  });

  const result = evaluateAction(action);

  // Expected decision and matching policy
  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.BULK_DELETE_GUARD);
  assert.match(result.reason, /bulk delete/i);

  // Expected risk assessment details
  assert.equal(result.riskAssessment.score, 100); // Scope (100) + Destructive (80) = 180 capped to 100
  assert.equal(result.riskAssessment.level, "CRITICAL");
  assert.equal(result.riskAssessment.factors.length, 2);
});

test("evaluateAction - Scenario B (External email): requires approval for send_emails with count 38 and destination external", () => {
  const action = makeAction({
    agentId: "sales-outreach-agent",
    toolId: "Email.sendBatch",
    operation: "send_emails",
    parameters: {
      count: 38,
      destination: "external",
    },
  });

  const result = evaluateAction(action);

  // Expected decision and matching policy
  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.EXTERNAL_EMAIL_REVIEW);
  assert.match(result.reason, /external destination/i);

  // Expected risk assessment: Scope (38) + External destination (20) = 58
  assert.equal(result.riskAssessment.score, 58);
  assert.equal(result.riskAssessment.level, "MEDIUM");
  assert.equal(result.riskAssessment.factors.length, 2);
});

test("evaluateAction - Scenario C (Knowledge-base read): allows read operation with count 12", () => {
  const action = makeAction({
    agentId: "research-agent",
    toolId: "KnowledgeBase.read",
    operation: "read",
    parameters: { count: 12 },
  });

  const result = evaluateAction(action);

  // Expected decision and matching policy
  assert.equal(result.decision, DECISIONS.ALLOW);
  assert.equal(result.policyId, POLICY_IDS.STANDARD_RISK_ALLOW);
  assert.match(result.reason, /acceptable risk level/i);

  // Expected risk assessment: Scope (12)
  assert.equal(result.riskAssessment.score, 12);
  assert.equal(result.riskAssessment.level, "LOW");
  assert.equal(result.riskAssessment.factors.length, 1);
});

test("evaluateAction - HIGH-risk approval: requires approval for non-email actions with HIGH risk", () => {
  const action = makeAction({
    agentId: "analytics-agent",
    toolId: "data_warehouse",
    operation: "fetch_records",
    parameters: { count: 65 },
  });

  const result = evaluateAction(action);

  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.HIGH_RISK_HUMAN_APPROVAL);
  assert.equal(result.riskAssessment.score, 65);
  assert.equal(result.riskAssessment.level, "HIGH");
});

test("evaluateAction - CRITICAL-risk blocking: blocks single delete operations under critical_risk_block", () => {
  const action = makeAction({
    agentId: "crm-agent",
    toolId: "crm_tool",
    operation: "delete_single_record",
    parameters: { count: 1 },
  });

  const result = evaluateAction(action);

  // Count is 1 (< 100), so Rule 1 does not match; Rule 2 (critical_risk_block) matches
  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.CRITICAL_RISK_BLOCK);
  assert.equal(result.riskAssessment.score, 81); // Destructive (80) + Scope (1) = 81
  assert.equal(result.riskAssessment.level, "CRITICAL");
});

test("evaluateAction - Rule priority: bulk_delete_guard blocks before critical_risk_block", () => {
  const action = makeAction({
    operation: "delete_customers",
    parameters: { count: 200 },
  });

  const result = evaluateAction(action);

  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.BULK_DELETE_GUARD);
});

test("evaluateAction - Rule priority: external_email_review requires approval before standard_risk_allow", () => {
  const action = makeAction({
    operation: "send_emails",
    parameters: { count: 5, destination: "external" },
  });

  const result = evaluateAction(action);

  // Risk score: 5 + 20 = 25 (LOW risk), but external email review takes priority
  assert.equal(result.riskAssessment.score, 25);
  assert.equal(result.riskAssessment.level, "LOW");
  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.EXTERNAL_EMAIL_REVIEW);
});

test("evaluateAction - deterministic: repeated calls return equivalent assessments and decisions", () => {
  const action = makeAction({
    operation: "send_emails",
    parameters: { count: 38, destination: "external" },
  });

  const run1 = evaluateAction(action);
  const run2 = evaluateAction(action);

  assert.deepEqual(run1, run2);
});

test("evaluateAction - pure: does not mutate the input action object", () => {
  const action = makeAction({
    operation: "delete_customers",
    parameters: { count: 147 },
  });

  Object.freeze(action);
  Object.freeze(action.parameters);

  const snapshot = JSON.parse(JSON.stringify(action));
  const result = evaluateAction(action);

  assert.deepEqual(action, snapshot);
  assert.equal(result.decision, DECISIONS.BLOCK);
});

test("evaluateAction - rejects invalid action inputs and fails closed", () => {
  assert.throws(() => evaluateAction(null), /Action must be a valid/);
  assert.throws(() => evaluateAction(undefined), /Action must be a valid/);
  assert.throws(() => evaluateAction("invalid"), /Action must be a valid/);

  // Invalid count parameter
  const invalidCountAction = {
    agentId: "agent-1",
    toolId: "tool-1",
    operation: "read",
    parameters: { count: -5 },
  };
  assert.throws(() => evaluateAction(invalidCountAction), /Invalid count parameter/);
});
