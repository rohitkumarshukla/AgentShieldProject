import test from "node:test";
import assert from "node:assert/strict";
import { createAction } from "../src/domain/action.js";
import {
  evaluatePolicy,
  DECISIONS,
  POLICY_IDS,
} from "../src/policy/policyEngine.js";

// Helper to quickly construct normalized test actions
function makeAction(overrides = {}) {
  return createAction({
    agentId: "agent-policy-test",
    toolId: "test_tool",
    operation: "test_operation",
    ...overrides,
  });
}

test("evaluatePolicy - Rule 1 (bulk_delete_guard): blocks delete operations with count >= 100", () => {
  const action = makeAction({
    operation: "delete_customers",
    parameters: { count: 147 },
  });
  const riskAssessment = { score: 100, level: "CRITICAL", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.BULK_DELETE_GUARD);
  assert.match(result.reason, /bulk delete/i);
});

test("evaluatePolicy - Rule 1 boundary: count === 100 triggers bulk_delete_guard", () => {
  const action = makeAction({
    operation: "batch_delete_records",
    parameters: { count: 100 },
  });
  const riskAssessment = { score: 100, level: "CRITICAL", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.BULK_DELETE_GUARD);
});

test("evaluatePolicy - Rule 2 (critical_risk_block): blocks CRITICAL risk when count < 100", () => {
  const action = makeAction({
    operation: "delete_single_record",
    parameters: { count: 1 },
  });
  const riskAssessment = { score: 81, level: "CRITICAL", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.CRITICAL_RISK_BLOCK);
  assert.match(result.reason, /CRITICAL risk/i);
});

test("evaluatePolicy - Rule 3 (external_email_review): requires approval for sending emails to external destination", () => {
  const action = makeAction({
    operation: "send_emails",
    parameters: { count: 38, destination: "external" },
  });
  const riskAssessment = { score: 58, level: "MEDIUM", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.EXTERNAL_EMAIL_REVIEW);
  assert.match(result.reason, /external destination/i);
});

test("evaluatePolicy - Rule 3 case-insensitivity: recognizes external destination with different casing and whitespace", () => {
  const action = makeAction({
    operation: "sendEmail",
    parameters: { destination: "  EXTERNAL  " },
  });
  const riskAssessment = { score: 20, level: "LOW", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.EXTERNAL_EMAIL_REVIEW);
});

test("evaluatePolicy - Rule 4 (high_risk_human_approval): requires approval for HIGH risk actions", () => {
  const action = makeAction({
    operation: "export_analytics",
    parameters: { count: 65 },
  });
  const riskAssessment = { score: 65, level: "HIGH", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.HIGH_RISK_HUMAN_APPROVAL);
  assert.match(result.reason, /HIGH risk/i);
});

test("evaluatePolicy - Rule 5 (standard_risk_allow): allows LOW and MEDIUM risk actions when no higher rules match", () => {
  const lowAction = makeAction({
    operation: "read",
    parameters: { count: 12 },
  });
  const lowRisk = { score: 12, level: "LOW", factors: [] };
  const lowResult = evaluatePolicy(lowAction, lowRisk);

  assert.equal(lowResult.decision, DECISIONS.ALLOW);
  assert.equal(lowResult.policyId, POLICY_IDS.STANDARD_RISK_ALLOW);

  const mediumAction = makeAction({
    operation: "query_internal_logs",
    parameters: { count: 45, destination: "internal" },
  });
  const mediumRisk = { score: 45, level: "MEDIUM", factors: [] };
  const mediumResult = evaluatePolicy(mediumAction, mediumRisk);

  assert.equal(mediumResult.decision, DECISIONS.ALLOW);
  assert.equal(mediumResult.policyId, POLICY_IDS.STANDARD_RISK_ALLOW);
});

test("evaluatePolicy - Priority 1 over Priority 2: bulk_delete_guard takes precedence over critical_risk_block", () => {
  const action = makeAction({
    operation: "delete_customers",
    parameters: { count: 150 },
  });
  const riskAssessment = { score: 100, level: "CRITICAL", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.BULK_DELETE_GUARD);
});

test("evaluatePolicy - Priority 2 over Priority 3: critical_risk_block takes precedence over external_email_review", () => {
  const action = makeAction({
    operation: "send_emails",
    parameters: { destination: "external", count: 90, irreversible: true },
  });
  const riskAssessment = { score: 100, level: "CRITICAL", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.policyId, POLICY_IDS.CRITICAL_RISK_BLOCK);
});

test("evaluatePolicy - Priority 3 over Priority 4: external_email_review takes precedence over high_risk_human_approval", () => {
  const action = makeAction({
    operation: "send_emails",
    parameters: { count: 50, destination: "external" },
  });
  const riskAssessment = { score: 70, level: "HIGH", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.EXTERNAL_EMAIL_REVIEW);
});

test("evaluatePolicy - Priority 3 over Priority 5: external_email_review takes precedence over standard_risk_allow", () => {
  const action = makeAction({
    operation: "send_emails",
    parameters: { count: 38, destination: "external" },
  });
  const riskAssessment = { score: 58, level: "MEDIUM", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.EXTERNAL_EMAIL_REVIEW);
});

test("evaluatePolicy - Priority 4 over Priority 5: high_risk_human_approval takes precedence over standard_risk_allow", () => {
  const action = makeAction({
    operation: "modify_config",
  });
  const riskAssessment = { score: 60, level: "HIGH", factors: [] };

  const result = evaluatePolicy(action, riskAssessment);

  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
  assert.equal(result.policyId, POLICY_IDS.HIGH_RISK_HUMAN_APPROVAL);
});

test("evaluatePolicy - fail closed: invalid or unsupported inputs throw errors and never produce ALLOW", () => {
  const validAction = makeAction({ operation: "read" });
  const validRisk = { score: 10, level: "LOW", factors: [] };

  // Null / undefined / invalid action
  assert.throws(() => evaluatePolicy(null, validRisk), /Action must be a valid plain object/);
  assert.throws(() => evaluatePolicy(undefined, validRisk), /Action must be a valid plain object/);
  assert.throws(() => evaluatePolicy("invalid", validRisk), /Action must be a valid plain object/);
  assert.throws(() => evaluatePolicy([], validRisk), /Action must be a valid plain object/);

  // Invalid operation
  assert.throws(() => evaluatePolicy({ ...validAction, operation: "" }, validRisk), /valid non-empty operation string/);
  assert.throws(() => evaluatePolicy({ ...validAction, operation: 123 }, validRisk), /valid non-empty operation string/);

  // Null / undefined / invalid riskAssessment
  assert.throws(() => evaluatePolicy(validAction, null), /Risk assessment must be a valid plain object/);
  assert.throws(() => evaluatePolicy(validAction, undefined), /Risk assessment must be a valid plain object/);
  assert.throws(() => evaluatePolicy(validAction, "invalid"), /Risk assessment must be a valid plain object/);

  // Unsupported or invalid risk level
  assert.throws(() => evaluatePolicy(validAction, { score: 10, level: "UNKNOWN" }), /Invalid or unsupported risk level/);
  assert.throws(() => evaluatePolicy(validAction, { score: 10, level: "CRITICAL_PLUS" }), /Invalid or unsupported risk level/);
  assert.throws(() => evaluatePolicy(validAction, { score: 10 }), /Invalid or unsupported risk level/);
});

test("evaluatePolicy - input immutability: does not modify action or risk assessment", () => {
  const action = makeAction({
    operation: "send_emails",
    parameters: { count: 38, destination: "external" },
  });
  const riskAssessment = { score: 58, level: "MEDIUM", factors: [] };

  Object.freeze(action);
  Object.freeze(action.parameters);
  Object.freeze(riskAssessment);

  const cloneAction = JSON.parse(JSON.stringify(action));
  const cloneRisk = JSON.parse(JSON.stringify(riskAssessment));

  const result = evaluatePolicy(action, riskAssessment);

  assert.deepEqual(action, cloneAction);
  assert.deepEqual(riskAssessment, cloneRisk);
  assert.equal(result.decision, DECISIONS.APPROVAL_REQUIRED);
});
