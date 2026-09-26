import assert from "node:assert/strict";
import test from "node:test";

import { createAuditEvent, deriveAuditStatus } from "./auditEvent.js";
import { validateAuditEvent } from "./auditEventValidator.js";

test("TEST 1: ALLOW decision -> status DECISION_MADE", () => {
  const event = createAuditEvent({
    action: {
      id: "act-1",
      agentId: "agent-1",
      actionType: "read",
      target: "crm.customers",
    },
    risk: {
      score: 0,
      level: "LOW",
      factors: [],
    },
    policy: {
      decision: "ALLOW",
      policyCode: "standard_risk_allow",
      reason: "Low risk automatic execution",
      requiresHumanApproval: false,
    },
  });

  assert.equal(event.status, "DECISION_MADE");
  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("TEST 2: APPROVAL_REQUIRED decision -> status AWAITING_APPROVAL", () => {
  const event = createAuditEvent({
    action: {
      id: "act-2",
      agentId: "agent-2",
      actionType: "write",
      target: "crm.settings",
    },
    risk: {
      score: 65,
      level: "HIGH",
      factors: [
        { code: "PRODUCTION_ENVIRONMENT", description: "Production", points: 15 },
        { code: "BULK_SCOPE_HIGH", description: "Bulk scope 25+", points: 35 },
      ],
    },
    policy: {
      decision: "APPROVAL_REQUIRED",
      policyCode: "high_risk_human_approval",
      reason: "High risk requires review",
      requiresHumanApproval: true,
    },
  });

  assert.equal(event.status, "AWAITING_APPROVAL");
  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("TEST 3: BLOCK decision -> status BLOCKED", () => {
  const event = createAuditEvent({
    action: {
      id: "act-3",
      agentId: "agent-3",
      actionType: "write",
      target: "crm.schema",
    },
    risk: {
      score: 95,
      level: "CRITICAL",
      factors: [
        { code: "PRODUCTION_ENVIRONMENT", description: "Production", points: 15 },
        { code: "BULK_SCOPE_CRITICAL", description: "Bulk scope 100+", points: 55 },
      ],
    },
    policy: {
      decision: "BLOCK",
      policyCode: "critical_risk_block",
      reason: "Critical risk blocked",
      requiresHumanApproval: false,
    },
  });

  assert.equal(event.status, "BLOCKED");
  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("TEST 4: Delete 147 decision -> score 100, CRITICAL, BLOCK, BLOCKED", () => {
  const event = createAuditEvent({
    action: {
      id: "act-4",
      agentId: "agent-cleanup",
      actionType: "delete",
      target: "crm.customers",
    },
    risk: {
      score: 100,
      level: "CRITICAL",
      factors: [
        { code: "DESTRUCTIVE_ACTION", description: "Destructive delete", points: 50 },
        { code: "BULK_SCOPE_CRITICAL", description: "Affects 100+ items", points: 55 },
      ],
    },
    policy: {
      decision: "BLOCK",
      policyCode: "bulk_delete_guard",
      reason: "Large-scale deletion is blocked",
      requiresHumanApproval: false,
    },
  });

  assert.equal(event.risk.score, 100);
  assert.equal(event.risk.level, "CRITICAL");
  assert.equal(event.policy.decision, "BLOCK");
  assert.equal(event.status, "BLOCKED");
  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, true);
});

test("TEST 5: Required field validation — missing actionId, agentId, target, risk, policy", () => {
  const emptyEvent = createAuditEvent({});
  const validation = validateAuditEvent(emptyEvent);

  assert.equal(validation.valid, false);
  const errorText = validation.errors.join(" ");
  assert.ok(errorText.includes("actionId"));
  assert.ok(errorText.includes("agentId"));
  assert.ok(errorText.includes("target"));
  assert.ok(errorText.includes("risk"));
  assert.ok(errorText.includes("policy"));
});

test("TEST 6: Invalid risk level", () => {
  const event = createAuditEvent({
    actionId: "act-6",
    agentId: "agent-6",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 10, level: "VERY_LOW", factors: [] },
    policy: { decision: "ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: false },
    status: "DECISION_MADE",
  });

  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes("risk.level")));
});

test("TEST 7: Invalid policy decision", () => {
  const event = createAuditEvent({
    actionId: "act-7",
    agentId: "agent-7",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 10, level: "LOW", factors: [] },
    policy: { decision: "MAYBE_ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: false },
    status: "DECISION_MADE",
  });

  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes("policy.decision")));
});

test("TEST 8: Invalid risk score (<0, >100, non-number)", () => {
  const base = {
    actionId: "act-8",
    agentId: "agent-8",
    actionType: "read",
    target: "crm.docs",
    policy: { decision: "ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: false },
    status: "DECISION_MADE",
  };

  const negativeScore = createAuditEvent({ ...base, risk: { score: -5, level: "LOW", factors: [] } });
  assert.equal(validateAuditEvent(negativeScore).valid, false);

  const overflowScore = createAuditEvent({ ...base, risk: { score: 105, level: "CRITICAL", factors: [] } });
  assert.equal(validateAuditEvent(overflowScore).valid, false);

  const nanScore = createAuditEvent({ ...base, risk: { score: "one-hundred", level: "CRITICAL", factors: [] } });
  assert.equal(validateAuditEvent(nanScore).valid, false);
});

test("TEST 9: Invalid status", () => {
  const event = createAuditEvent({
    actionId: "act-9",
    agentId: "agent-9",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 10, level: "LOW", factors: [] },
    policy: { decision: "ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: false },
    status: "UNKNOWN_STATUS",
  });

  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes("status")));
});

test("TEST 10: Invalid createdAt", () => {
  const event = createAuditEvent({
    actionId: "act-10",
    agentId: "agent-10",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 10, level: "LOW", factors: [] },
    policy: { decision: "ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: false },
    status: "DECISION_MADE",
    createdAt: "invalid-timestamp",
  });

  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes("createdAt")));
});

test("TEST 11: Policy consistency — mismatches with requiresHumanApproval", () => {
  // ALLOW with requiresHumanApproval: true
  const allowMismatch = createAuditEvent({
    actionId: "act-11a",
    agentId: "agent-11",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 0, level: "LOW", factors: [] },
    policy: { decision: "ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: true },
    status: "DECISION_MADE",
  });
  assert.equal(validateAuditEvent(allowMismatch).valid, false);

  // APPROVAL_REQUIRED with requiresHumanApproval: false
  const approvalMismatch = createAuditEvent({
    actionId: "act-11b",
    agentId: "agent-11",
    actionType: "write",
    target: "crm.docs",
    risk: { score: 60, level: "HIGH", factors: [] },
    policy: { decision: "APPROVAL_REQUIRED", policyCode: "p2", reason: "r", requiresHumanApproval: false },
    status: "AWAITING_APPROVAL",
  });
  assert.equal(validateAuditEvent(approvalMismatch).valid, false);

  // BLOCK with requiresHumanApproval: true
  const blockMismatch = createAuditEvent({
    actionId: "act-11c",
    agentId: "agent-11",
    actionType: "delete",
    target: "crm.docs",
    risk: { score: 100, level: "CRITICAL", factors: [] },
    policy: { decision: "BLOCK", policyCode: "p3", reason: "r", requiresHumanApproval: true },
    status: "BLOCKED",
  });
  assert.equal(validateAuditEvent(blockMismatch).valid, false);
});

test("TEST 12: Status consistency — mismatches between decision and status", () => {
  // ALLOW with status BLOCKED
  const event = createAuditEvent({
    actionId: "act-12",
    agentId: "agent-12",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 0, level: "LOW", factors: [] },
    policy: { decision: "ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: false },
    status: "BLOCKED",
  });

  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes("Consistency error")));
});

test("TEST 13: Nested risk factor validation", () => {
  const event = createAuditEvent({
    actionId: "act-13",
    agentId: "agent-13",
    actionType: "write",
    target: "crm.docs",
    risk: {
      score: 50,
      level: "HIGH",
      factors: [
        { code: "", description: "desc", points: 50 }, // Empty code
        { code: "CODE", description: "", points: 50 }, // Empty description
        { code: "CODE", description: "desc", points: "not-a-number" }, // Invalid points
      ],
    },
    policy: { decision: "APPROVAL_REQUIRED", policyCode: "p", reason: "r", requiresHumanApproval: true },
    status: "AWAITING_APPROVAL",
  });

  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, false);
  assert.equal(validation.errors.length, 3);
});

test("TEST 14: Metadata validation", () => {
  const event = createAuditEvent({
    actionId: "act-14",
    agentId: "agent-14",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 0, level: "LOW", factors: [] },
    policy: { decision: "ALLOW", policyCode: "p", reason: "r", requiresHumanApproval: false },
    status: "DECISION_MADE",
    metadata: "not-an-object",
  });

  const validation = validateAuditEvent(event);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes("metadata must be an object")));
});

test("TEST 15: Input immutability", () => {
  const action = { id: "act-15", agentId: "agent-15", actionType: "read", target: "crm.docs" };
  const risk = { score: 0, level: "LOW", factors: [{ code: "F1", description: "D1", points: 0 }] };
  const policy = { decision: "ALLOW", policyCode: "p1", reason: "r1", requiresHumanApproval: false };

  const actionSnapshot = JSON.stringify(action);
  const riskSnapshot = JSON.stringify(risk);
  const policySnapshot = JSON.stringify(policy);

  const event = createAuditEvent({ action, risk, policy });

  // Modify returned event properties
  event.risk.score = 99;
  event.risk.factors[0].points = 99;
  event.policy.reason = "mutated";

  assert.equal(JSON.stringify(action), actionSnapshot);
  assert.equal(JSON.stringify(risk), riskSnapshot);
  assert.equal(JSON.stringify(policy), policySnapshot);
});

test("TEST 16: Determinism of supplied id/timestamp", () => {
  const payload = {
    id: "fixed-event-id",
    actionId: "act-16",
    agentId: "agent-16",
    actionType: "read",
    target: "crm.docs",
    risk: { score: 0, level: "LOW", factors: [] },
    policy: { decision: "ALLOW", policyCode: "p1", reason: "r", requiresHumanApproval: false },
    status: "DECISION_MADE",
    createdAt: "2026-09-26T11:00:00.000Z",
    metadata: { env: "prod" },
  };

  const event1 = createAuditEvent(payload);
  const event2 = createAuditEvent(payload);

  assert.deepEqual(event1, event2);
});

test("TEST 17: deriveAuditStatus helper edge case", () => {
  assert.equal(deriveAuditStatus("ALLOW"), "DECISION_MADE");
  assert.equal(deriveAuditStatus("APPROVAL_REQUIRED"), "AWAITING_APPROVAL");
  assert.equal(deriveAuditStatus("BLOCK"), "BLOCKED");
  assert.throws(() => deriveAuditStatus("UNKNOWN"), /Unsupported policy decision/);
});
