import assert from "node:assert/strict";
import test from "node:test";

import { createAction } from "./action.js";
import { validateAction } from "./actionValidator.js";

test("TEST 1: Create a valid single read action", () => {
  const action = createAction({
    agentId: "agent-123",
    actionType: "read",
    target: "knowledge_base",
    description: "Read documentation articles",
    scope: { type: "single", count: 1 },
    destination: { type: "internal", value: "wiki" },
    environment: "development",
    sensitivity: { level: "internal" },
    financialImpact: 0,
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.ok(typeof action.id === "string" && action.id.length > 0, "generated id must exist");
  assert.ok(typeof action.createdAt === "string" && action.createdAt.length > 0, "createdAt must exist");
  assert.equal(action.actionType, "read");
  assert.equal(action.target, "knowledge_base");
});

test("TEST 2: Create a valid bulk delete action", () => {
  const action = createAction({
    agentId: "demo-agent",
    actionType: "delete",
    target: "crm.customers",
    description: "Delete 147 CRM customers",
    scope: {
      type: "bulk",
      count: 147,
    },
    destination: {
      type: "internal",
      value: "crm",
    },
    environment: "production",
    sensitivity: {
      level: "sensitive",
    },
    financialImpact: 0,
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(action.scope.count, 147);
  assert.equal(action.environment, "production");
  assert.equal(action.sensitivity.level, "sensitive");
});

test("TEST 3: Create a valid external send action", () => {
  const action = createAction({
    agentId: "agent-sales",
    actionType: "send",
    target: "crm.leads",
    description: "Send follow-up emails to 38 leads",
    scope: {
      type: "bulk",
      count: 38,
    },
    destination: {
      type: "external",
      value: "customer@example.com",
    },
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(action.destination.type, "external");
  assert.equal(action.destination.value, "customer@example.com");
});

test("TEST 4: Reject missing agentId", () => {
  const action = createAction({
    actionType: "read",
    target: "crm.customers",
    description: "Read customer profile",
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((err) => err.includes("agentId")),
    "Errors should contain an agentId error",
  );
});

test("TEST 5: Reject unsupported actionType", () => {
  const action = createAction({
    agentId: "agent-123",
    actionType: "hack",
    target: "crm.customers",
    description: "Exploit vulnerability",
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((err) => err.includes("actionType")),
    "Errors should reject invalid actionType",
  );
});

test("TEST 6: Reject negative scope count", () => {
  const action = createAction({
    agentId: "agent-123",
    actionType: "read",
    target: "crm.customers",
    description: "Read records",
    scope: { type: "bulk", count: -5 },
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((err) => err.includes("scope.count")),
    "Errors should reject negative scope.count",
  );
});

test("TEST 7: Reject invalid environment", () => {
  const action = createAction({
    agentId: "agent-123",
    actionType: "read",
    target: "crm.customers",
    description: "Read records",
    environment: "sandbox_unknown",
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((err) => err.includes("environment")),
    "Errors should reject unsupported environment",
  );
});

test("TEST 8: Reject negative financialImpact", () => {
  const action = createAction({
    agentId: "agent-123",
    actionType: "execute",
    target: "billing.charge",
    description: "Issue transaction",
    financialImpact: -100,
  });

  const validation = validateAction(action);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((err) => err.includes("financialImpact")),
    "Errors should reject negative financialImpact",
  );
});
