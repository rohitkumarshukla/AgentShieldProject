import assert from "node:assert/strict";
import test from "node:test";

import { createAction } from "../domain/action.js";
import { RiskEngine } from "./riskEngine.js";

const engine = new RiskEngine();

test("TEST 1: LOW risk — simple internal read", () => {
  const action = createAction({
    agentId: "agent-kb",
    actionType: "read",
    target: "knowledge_base",
    description: "Read internal documentation",
    scope: { type: "single", count: 1 },
    destination: { type: "internal", value: "wiki" },
    environment: "development",
    sensitivity: { level: "internal" },
    financialImpact: 0,
  });

  const assessment = engine.evaluate(action);

  assert.equal(assessment.score, 0);
  assert.equal(assessment.level, "LOW");
  assert.deepEqual(assessment.factors, []);
});

test("TEST 2: External send — send + external destination", () => {
  const action = createAction({
    agentId: "agent-mail",
    actionType: "send",
    target: "messaging.email",
    description: "Send status update to external recipient",
    scope: { type: "single", count: 1 },
    destination: { type: "external", value: "user@example.com" },
    environment: "development",
    sensitivity: { level: "internal" },
  });

  const assessment = engine.evaluate(action);

  assert.equal(assessment.score, 20);
  assert.equal(assessment.level, "MEDIUM");
  assert.equal(assessment.factors.length, 1);
  assert.deepEqual(assessment.factors[0], {
    code: "EXTERNAL_DESTINATION",
    description: "Action sends data or performs an operation outside the internal environment",
    points: 20,
  });
});

test("TEST 3: Production write — write + production environment", () => {
  const action = createAction({
    agentId: "agent-ops",
    actionType: "write",
    target: "app.settings",
    description: "Update application banner message",
    environment: "production",
  });

  const assessment = engine.evaluate(action);

  assert.equal(assessment.score, 15);
  assert.equal(assessment.level, "LOW");
  assert.equal(assessment.factors.length, 1);
  assert.deepEqual(assessment.factors[0], {
    code: "PRODUCTION_ENVIRONMENT",
    description: "Action targets the production environment",
    points: 15,
  });
});

test("TEST 4: Delete 10 — delete + scope count 10 (total = 70, level = HIGH)", () => {
  const action = createAction({
    agentId: "agent-cleanup",
    actionType: "delete",
    target: "temp.files",
    description: "Delete 10 stale logs",
    scope: { type: "bulk", count: 10 },
  });

  const assessment = engine.evaluate(action);

  assert.equal(assessment.score, 70);
  assert.equal(assessment.level, "HIGH");
  assert.equal(assessment.factors.length, 2);
  assert.deepEqual(assessment.factors[0], {
    code: "DESTRUCTIVE_ACTION",
    description: "Delete action is inherently destructive",
    points: 50,
  });
  assert.deepEqual(assessment.factors[1], {
    code: "BULK_SCOPE_MEDIUM",
    description: "Action affects 10 or more resources",
    points: 20,
  });
});

test("TEST 5: Delete 25 — delete + scope count 25 (total = 85, level = CRITICAL)", () => {
  const action = createAction({
    agentId: "agent-cleanup",
    actionType: "delete",
    target: "orders.drafts",
    description: "Delete 25 draft orders",
    scope: { type: "bulk", count: 25 },
  });

  const assessment = engine.evaluate(action);

  assert.equal(assessment.score, 85);
  assert.equal(assessment.level, "CRITICAL");
  assert.equal(assessment.factors.length, 2);
  assert.deepEqual(assessment.factors[0], {
    code: "DESTRUCTIVE_ACTION",
    description: "Delete action is inherently destructive",
    points: 50,
  });
  assert.deepEqual(assessment.factors[1], {
    code: "BULK_SCOPE_HIGH",
    description: "Action affects 25 or more resources",
    points: 35,
  });
});

test("TEST 6: Delete 147 — delete + scope count 147 (raw = 105, clamped = 100, CRITICAL)", () => {
  const action = createAction({
    agentId: "agent-cleanup",
    actionType: "delete",
    target: "crm.customers",
    description: "Delete 147 CRM customers",
    scope: { type: "bulk", count: 147 },
  });

  const assessment = engine.evaluate(action);

  assert.equal(assessment.score, 100);
  assert.equal(assessment.level, "CRITICAL");
  assert.equal(assessment.factors.length, 2);
  assert.deepEqual(assessment.factors[0], {
    code: "DESTRUCTIVE_ACTION",
    description: "Delete action is inherently destructive",
    points: 50,
  });
  assert.deepEqual(assessment.factors[1], {
    code: "BULK_SCOPE_CRITICAL",
    description: "Action affects 100 or more resources",
    points: 55,
  });
});

test("TEST 7: Sensitive production read — sensitive + production", () => {
  const action = createAction({
    agentId: "agent-audit",
    actionType: "read",
    target: "users.credentials",
    description: "Read user authentication records",
    environment: "production",
    sensitivity: { level: "sensitive" },
  });

  const assessment = engine.evaluate(action);

  assert.equal(assessment.score, 35);
  assert.equal(assessment.level, "MEDIUM");
  assert.equal(assessment.factors.length, 2);
  assert.deepEqual(assessment.factors[0], {
    code: "SENSITIVE_DATA",
    description: "Action involves sensitive or restricted data",
    points: 20,
  });
  assert.deepEqual(assessment.factors[1], {
    code: "PRODUCTION_ENVIRONMENT",
    description: "Action targets the production environment",
    points: 15,
  });
});

test("TEST 8: Financial tiers — 500 (+10), 5000 (+25), 15000 (+35)", () => {
  const action500 = createAction({
    agentId: "agent-billing",
    actionType: "execute",
    target: "billing.invoice",
    description: "Process small refund",
    financialImpact: 500,
  });
  const assessment500 = engine.evaluate(action500);
  assert.equal(assessment500.score, 10);
  assert.equal(assessment500.factors.length, 1);
  assert.equal(assessment500.factors[0].code, "FINANCIAL_IMPACT_LOW");
  assert.equal(assessment500.factors[0].points, 10);

  const action5000 = createAction({
    agentId: "agent-billing",
    actionType: "execute",
    target: "billing.invoice",
    description: "Process standard invoice",
    financialImpact: 5000,
  });
  const assessment5000 = engine.evaluate(action5000);
  assert.equal(assessment5000.score, 25);
  assert.equal(assessment5000.factors.length, 1);
  assert.equal(assessment5000.factors[0].code, "FINANCIAL_IMPACT_HIGH");
  assert.equal(assessment5000.factors[0].points, 25);

  const action15000 = createAction({
    agentId: "agent-billing",
    actionType: "execute",
    target: "billing.invoice",
    description: "Process large transfer",
    financialImpact: 15000,
  });
  const assessment15000 = engine.evaluate(action15000);
  assert.equal(assessment15000.score, 35);
  assert.equal(assessment15000.factors.length, 1);
  assert.equal(assessment15000.factors[0].code, "FINANCIAL_IMPACT_CRITICAL");
  assert.equal(assessment15000.factors[0].points, 35);
});

test("TEST 9: Combined action — external + sensitive + production", () => {
  const action = createAction({
    agentId: "agent-export",
    actionType: "export",
    target: "crm.customers",
    description: "Export customer list to partner",
    destination: { type: "external", value: "partner@example.com" },
    environment: "production",
    sensitivity: { level: "sensitive" },
  });

  const assessment = engine.evaluate(action);

  // 20 (external) + 20 (sensitive) + 15 (production) = 55
  assert.equal(assessment.score, 55);
  assert.equal(assessment.level, "HIGH");
  assert.equal(assessment.factors.length, 3);

  // Verify strict deterministic factor order:
  assert.equal(assessment.factors[0].code, "EXTERNAL_DESTINATION");
  assert.equal(assessment.factors[1].code, "SENSITIVE_DATA");
  assert.equal(assessment.factors[2].code, "PRODUCTION_ENVIRONMENT");
});

test("TEST 10: Determinism — evaluate identical action twice", () => {
  const action = createAction({
    agentId: "agent-demo",
    actionType: "delete",
    target: "db.records",
    description: "Delete records",
    scope: { type: "bulk", count: 30 },
    destination: { type: "external", value: "ext-sink" },
    environment: "production",
    sensitivity: { level: "restricted" },
    financialImpact: 12000,
  });

  const assessment1 = engine.evaluate(action);
  const assessment2 = engine.evaluate(action);

  assert.deepEqual(assessment1, assessment2);
  assert.equal(assessment1.score, assessment2.score);
  assert.equal(assessment1.level, assessment2.level);
  assert.deepEqual(
    assessment1.factors.map((f) => f.code),
    assessment2.factors.map((f) => f.code),
  );
  assert.deepEqual(
    assessment1.factors.map((f) => f.points),
    assessment2.factors.map((f) => f.points),
  );
});

test("TEST 11: Invalid input — evaluate() throws clear error for missing/null/invalid action", () => {
  assert.throws(
    () => engine.evaluate(null),
    {
      name: "Error",
      message: /RiskEngine\.evaluate requires a valid action object/,
    },
  );

  assert.throws(
    () => engine.evaluate(undefined),
    {
      name: "Error",
      message: /RiskEngine\.evaluate requires a valid action object/,
    },
  );

  assert.throws(
    () => engine.evaluate("not-an-object"),
    {
      name: "Error",
      message: /RiskEngine\.evaluate requires a valid action object/,
    },
  );

  assert.throws(
    () => engine.evaluate({ actionType: "invalid-action-type" }),
    {
      name: "Error",
      message: /RiskEngine\.evaluate requires a valid action object/,
    },
  );
});
