import assert from "node:assert/strict";
import test from "node:test";

import { createAction } from "../domain/action.js";
import { PolicyEngine } from "./policyEngine.js";

const engine = new PolicyEngine();

test("TEST 1: LOW risk read -> ALLOW, standard_risk_allow, requiresHumanApproval = false", () => {
  const action = createAction({
    agentId: "agent-1",
    actionType: "read",
    target: "docs.public",
    description: "Read documentation",
  });
  const riskAssessment = { score: 0, level: "LOW", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.decision, "ALLOW");
  assert.equal(result.policyCode, "standard_risk_allow");
  assert.equal(result.requiresHumanApproval, false);
  assert.match(result.reason, /automatic execution risk threshold/i);
});

test("TEST 2: MEDIUM risk write -> ALLOW, standard_risk_allow", () => {
  const action = createAction({
    agentId: "agent-1",
    actionType: "write",
    target: "crm.notes",
    description: "Append note to contact",
  });
  const riskAssessment = { score: 35, level: "MEDIUM", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.decision, "ALLOW");
  assert.equal(result.policyCode, "standard_risk_allow");
  assert.equal(result.requiresHumanApproval, false);
});

test("TEST 3: HIGH risk generic action -> APPROVAL_REQUIRED, high_risk_human_approval", () => {
  const action = createAction({
    agentId: "agent-1",
    actionType: "write",
    target: "billing.invoices",
    description: "Modify invoice record",
  });
  const riskAssessment = { score: 65, level: "HIGH", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.decision, "APPROVAL_REQUIRED");
  assert.equal(result.policyCode, "high_risk_human_approval");
  assert.equal(result.requiresHumanApproval, true);
  assert.match(result.reason, /high-risk actions require human approval/i);
});

test("TEST 4: CRITICAL risk generic action -> BLOCK, critical_risk_block", () => {
  const action = createAction({
    agentId: "agent-1",
    actionType: "write",
    target: "core.database",
    description: "Direct schema rewrite",
  });
  const riskAssessment = { score: 95, level: "CRITICAL", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.policyCode, "critical_risk_block");
  assert.equal(result.requiresHumanApproval, false);
  assert.match(result.reason, /critical-risk actions are blocked automatically/i);
});

test("TEST 5: Delete 147 records -> BLOCK, bulk_delete_guard", () => {
  const action = createAction({
    agentId: "agent-cleanup",
    actionType: "delete",
    target: "crm.customers",
    description: "Delete 147 CRM customers",
    scope: { type: "bulk", count: 147 },
  });
  const riskAssessment = { score: 100, level: "CRITICAL", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.policyCode, "bulk_delete_guard");
  assert.equal(result.requiresHumanApproval, false);
  assert.match(result.reason, /large-scale deletion is blocked/i);
});

test("TEST 6: Delete 99 records with CRITICAL risk -> BLOCK, critical_risk_block", () => {
  const action = createAction({
    agentId: "agent-cleanup",
    actionType: "delete",
    target: "crm.customers",
    description: "Delete 99 CRM customers",
    scope: { type: "bulk", count: 99 },
  });
  const riskAssessment = { score: 85, level: "CRITICAL", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  // Because count (99) < 100, bulk_delete_guard does not trigger; falls through to critical_risk_block
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.policyCode, "critical_risk_block");
  assert.equal(result.requiresHumanApproval, false);
});

test("TEST 7: External high-risk send -> APPROVAL_REQUIRED, external_email_review", () => {
  const action = createAction({
    agentId: "agent-mailer",
    actionType: "send",
    target: "crm.leads",
    description: "Send campaign emails",
    destination: { type: "external", value: "leads@example.com" },
  });
  const riskAssessment = { score: 55, level: "HIGH", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.decision, "APPROVAL_REQUIRED");
  assert.equal(result.policyCode, "external_email_review");
  assert.equal(result.requiresHumanApproval, true);
  assert.match(result.reason, /external communication at high risk requires human review/i);
});

test("TEST 8: External medium-risk send -> ALLOW, standard_risk_allow", () => {
  const action = createAction({
    agentId: "agent-mailer",
    actionType: "send",
    target: "crm.leads",
    description: "Send single email",
    destination: { type: "external", value: "lead@example.com" },
  });
  const riskAssessment = { score: 20, level: "MEDIUM", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.decision, "ALLOW");
  assert.equal(result.policyCode, "standard_risk_allow");
  assert.equal(result.requiresHumanApproval, false);
});

test("TEST 9: Policy precedence — delete >= 100 with CRITICAL risk triggers bulk_delete_guard", () => {
  const action = createAction({
    agentId: "agent-cleanup",
    actionType: "delete",
    target: "crm.records",
    description: "Bulk wipe",
    scope: { type: "bulk", count: 500 },
  });
  const riskAssessment = { score: 100, level: "CRITICAL", factors: [] };

  const result = engine.evaluate(action, riskAssessment);

  assert.equal(result.policyCode, "bulk_delete_guard");
  assert.notEqual(result.policyCode, "critical_risk_block");
});

test("TEST 10: Invalid input — evaluate() throws for missing/invalid input", () => {
  const validAction = createAction({
    agentId: "agent-1",
    actionType: "read",
    target: "docs",
    description: "Read docs",
  });
  const validRisk = { score: 0, level: "LOW", factors: [] };

  // Null action
  assert.throws(
    () => engine.evaluate(null, validRisk),
    {
      name: "Error",
      message: /PolicyEngine\.evaluate requires a valid action object/,
    },
  );

  // Null risk assessment
  assert.throws(
    () => engine.evaluate(validAction, null),
    {
      name: "Error",
      message: /PolicyEngine\.evaluate requires a valid riskAssessment object/,
    },
  );

  // Missing risk level
  assert.throws(
    () => engine.evaluate(validAction, { score: 0 }),
    {
      name: "Error",
      message: /PolicyEngine\.evaluate requires a risk level on riskAssessment/,
    },
  );

  // Invalid risk level
  assert.throws(
    () => engine.evaluate(validAction, { score: 0, level: "SUPER_CRITICAL" }),
    {
      name: "Error",
      message: /PolicyEngine\.evaluate encountered unsupported risk level/,
    },
  );
});
