import test from "node:test";
import assert from "node:assert/strict";
import { createAction } from "../src/domain/action.js";
import {
  calculateRisk,
  getRiskLevel,
  RISK_LEVELS,
} from "../src/risk/riskEngine.js";

// Helper to quickly build standard normalized actions
function makeAction(overrides = {}) {
  return createAction({
    agentId: "agent-security-test",
    toolId: "test_tool",
    operation: "test_operation",
    ...overrides,
  });
}

test("calculateRisk - reading 12 items produces score 12 and LOW", () => {
  const action = makeAction({
    operation: "knowledgeBase.read",
    parameters: { count: 12 },
  });

  const assessment = calculateRisk(action);

  assert.equal(assessment.score, 12);
  assert.equal(assessment.level, "LOW");
  assert.deepEqual(assessment.factors, [
    { name: "Scope", points: 12 },
  ]);
  assert.equal(
    assessment.score,
    Math.min(100, assessment.factors.reduce((sum, f) => sum + f.points, 0))
  );
});

test("calculateRisk - sending 38 emails to an external destination produces score 58 and MEDIUM", () => {
  const action = makeAction({
    operation: "Email.sendBatch",
    parameters: {
      count: 38,
      destination: "external",
    },
  });

  const assessment = calculateRisk(action);

  assert.equal(assessment.score, 58);
  assert.equal(assessment.level, "MEDIUM");
  assert.deepEqual(assessment.factors, [
    { name: "Scope", points: 38 },
    { name: "External destination", points: 20 },
  ]);
  assert.equal(
    assessment.score,
    Math.min(100, assessment.factors.reduce((sum, f) => sum + f.points, 0))
  );
});

test("calculateRisk - deleting 147 customer records produces score 100 and CRITICAL", () => {
  const action = makeAction({
    operation: "CRM.deleteCustomers",
    parameters: {
      count: 147,
    },
  });

  const assessment = calculateRisk(action);

  assert.equal(assessment.score, 100);
  assert.equal(assessment.level, "CRITICAL");
  assert.deepEqual(assessment.factors, [
    { name: "Scope", points: 100 },
    { name: "Destructive operation", points: 80 },
  ]);
  // The capped sum of factors (100 + 80 = 180, capped at 100) equals score
  assert.equal(
    assessment.score,
    Math.min(100, assessment.factors.reduce((sum, f) => sum + f.points, 0))
  );
});

test("calculateRisk - non-destructive action with no optional risk factors has score 0 and LOW", () => {
  const action = makeAction({
    operation: "readRecord",
    parameters: {},
  });

  const assessment = calculateRisk(action);

  assert.equal(assessment.score, 0);
  assert.equal(assessment.level, "LOW");
  assert.deepEqual(assessment.factors, []);
  assert.equal(
    assessment.score,
    Math.min(100, assessment.factors.reduce((sum, f) => sum + f.points, 0))
  );
});

test("calculateRisk - non-destructive action with count: 0 has score 0 and LOW", () => {
  const action = makeAction({
    operation: "listItems",
    parameters: { count: 0 },
  });

  const assessment = calculateRisk(action);

  assert.equal(assessment.score, 0);
  assert.equal(assessment.level, "LOW");
  assert.deepEqual(assessment.factors, []);
});

test("calculateRisk - all four risk-level boundaries are correct: 29/30, 59/60, and 79/80", () => {
  // Boundary 29 (LOW) vs 30 (MEDIUM)
  const action29 = makeAction({
    operation: "inspect",
    parameters: { count: 29 },
  });
  const res29 = calculateRisk(action29);
  assert.equal(res29.score, 29);
  assert.equal(res29.level, "LOW");

  const action30 = makeAction({
    operation: "inspect",
    parameters: { count: 30 },
  });
  const res30 = calculateRisk(action30);
  assert.equal(res30.score, 30);
  assert.equal(res30.level, "MEDIUM");

  // Boundary 59 (MEDIUM) vs 60 (HIGH)
  const action59 = makeAction({
    operation: "inspect",
    parameters: { count: 34, destination: "external", dataClassification: "PII" }, // 34 + 20 + 5 = 59
  });
  const res59 = calculateRisk(action59);
  assert.equal(res59.score, 59);
  assert.equal(res59.level, "MEDIUM");

  const action60 = makeAction({
    operation: "inspect",
    parameters: { count: 40, destination: "external" }, // 40 + 20 = 60
  });
  const res60 = calculateRisk(action60);
  assert.equal(res60.score, 60);
  assert.equal(res60.level, "HIGH");

  // Boundary 79 (HIGH) vs 80 (CRITICAL)
  const action79 = makeAction({
    operation: "inspect",
    parameters: { count: 54, destination: "external", dataClassification: "FINANCIAL" }, // 54 + 20 + 5 = 79
  });
  const res79 = calculateRisk(action79);
  assert.equal(res79.score, 79);
  assert.equal(res79.level, "HIGH");

  const action80 = makeAction({
    operation: "deleteRecord", // 80 points
    parameters: {},
  });
  const res80 = calculateRisk(action80);
  assert.equal(res80.score, 80);
  assert.equal(res80.level, "CRITICAL");
});

test("calculateRisk - getRiskLevel helper function maps correctly across boundaries", () => {
  assert.equal(getRiskLevel(0), RISK_LEVELS.LOW);
  assert.equal(getRiskLevel(29), RISK_LEVELS.LOW);
  assert.equal(getRiskLevel(30), RISK_LEVELS.MEDIUM);
  assert.equal(getRiskLevel(59), RISK_LEVELS.MEDIUM);
  assert.equal(getRiskLevel(60), RISK_LEVELS.HIGH);
  assert.equal(getRiskLevel(79), RISK_LEVELS.HIGH);
  assert.equal(getRiskLevel(80), RISK_LEVELS.CRITICAL);
  assert.equal(getRiskLevel(100), RISK_LEVELS.CRITICAL);
});

test("calculateRisk - scores never exceed 100 when multiple high-impact factors accumulate", () => {
  // Scope (100) + Destructive (80) + External (20) + Sensitive (5) + Irreversible (20) = 225 raw points
  const action = makeAction({
    operation: "bulkDeleteAll",
    parameters: {
      count: 500,
      destination: "external",
      dataClassification: "FINANCIAL",
      irreversible: true,
    },
  });

  const assessment = calculateRisk(action);

  assert.equal(assessment.score, 100);
  assert.equal(assessment.level, "CRITICAL");
  assert.equal(assessment.factors.length, 5);
  // Ensure score equals capped sum of returned factors
  const sumOfFactors = assessment.factors.reduce((sum, f) => sum + f.points, 0);
  assert.equal(sumOfFactors, 225);
  assert.equal(assessment.score, Math.min(100, sumOfFactors));
});

test("calculateRisk - invalid count values are rejected with descriptive errors", () => {
  const invalidCounts = [
    -1,
    -100,
    3.14,
    0.5,
    "10",
    "many",
    null,
    NaN,
    Infinity,
    -Infinity,
    {},
    [],
    true,
    false,
  ];

  for (const count of invalidCounts) {
    const rawInput = {
      agentId: "agent-1",
      toolId: "tool-1",
      operation: "op",
      parameters: { count },
    };

    assert.throws(
      () => calculateRisk(rawInput),
      /Invalid count parameter.*non-negative integer/,
      `Expected count ${JSON.stringify(count)} to be rejected`
    );
  }
});

test("calculateRisk - input action is not modified (pure function)", () => {
  const inputAction = makeAction({
    operation: "deleteAccount",
    parameters: {
      count: 25,
      destination: "external",
      dataClassification: "PII",
      irreversible: true,
    },
  });

  // Deeply freeze the action object to ensure calculateRisk does not mutate it
  Object.freeze(inputAction);
  Object.freeze(inputAction.parameters);

  const cloneBefore = JSON.parse(JSON.stringify(inputAction));
  const assessment = calculateRisk(inputAction);

  assert.deepEqual(inputAction, cloneBefore);
  assert.equal(assessment.score, 100); // 25 + 80 + 20 + 5 + 20 = 150 -> 100
});

test("calculateRisk - repeated calls with identical input return equivalent assessments (deterministic)", () => {
  const action = makeAction({
    operation: "syncCustomerData",
    parameters: {
      count: 45,
      destination: "external",
      dataClassification: "pii",
      irreversible: true,
    },
  });

  const assessment1 = calculateRisk(action);
  const assessment2 = calculateRisk(action);

  assert.deepEqual(assessment1, assessment2);
  assert.notEqual(assessment1.factors, assessment2.factors); // returns new factor arrays
});

test("calculateRisk - case-insensitivity handling for destructive operation, destination, and data classification", () => {
  // 1. Destructive operation case-insensitivity: contains "delete"
  const upperDelete = makeAction({ operation: "BATCH_DELETE_USERS" });
  assert.equal(calculateRisk(upperDelete).score, 80);

  const mixedDelete = makeAction({ operation: "softDeleteArchive" });
  assert.equal(calculateRisk(mixedDelete).score, 80);

  // 2. External destination case-insensitivity
  const upperDest = makeAction({
    operation: "exportData",
    parameters: { destination: "EXTERNAL" },
  });
  assert.equal(calculateRisk(upperDest).score, 20);

  const paddedDest = makeAction({
    operation: "exportData",
    parameters: { destination: "  external  " },
  });
  assert.equal(calculateRisk(paddedDest).score, 20);

  // 3. Data classification case-insensitivity: PII and FINANCIAL
  const lowerPii = makeAction({
    operation: "inspect",
    parameters: { dataClassification: "pii" },
  });
  assert.equal(calculateRisk(lowerPii).score, 5);

  const mixedFinancial = makeAction({
    operation: "inspect",
    parameters: { dataClassification: "Financial" },
  });
  assert.equal(calculateRisk(mixedFinancial).score, 5);

  const nonSensitive = makeAction({
    operation: "inspect",
    parameters: { dataClassification: "public" },
  });
  assert.equal(calculateRisk(nonSensitive).score, 0);
});

test("calculateRisk - irreversibility evaluation", () => {
  const irreversibleTrue = makeAction({
    operation: "wipeCache",
    parameters: { irreversible: true },
  });
  const resTrue = calculateRisk(irreversibleTrue);
  assert.equal(resTrue.score, 20);
  assert.deepEqual(resTrue.factors, [{ name: "Irreversibility", points: 20 }]);

  const irreversibleFalse = makeAction({
    operation: "wipeCache",
    parameters: { irreversible: false },
  });
  const resFalse = calculateRisk(irreversibleFalse);
  assert.equal(resFalse.score, 0);
  assert.deepEqual(resFalse.factors, []);

  // String "true" should not be treated as boolean true
  const irreversibleString = makeAction({
    operation: "wipeCache",
    parameters: { irreversible: "true" },
  });
  assert.equal(calculateRisk(irreversibleString).score, 0);
});

test("calculateRisk - rejects invalid action input", () => {
  assert.throws(() => calculateRisk(null), /Action must be a valid action object/);
  assert.throws(() => calculateRisk(undefined), /Action must be a valid action object/);
  assert.throws(() => calculateRisk("not-an-action"), /Action must be a valid action object/);
  assert.throws(() => calculateRisk([]), /Action must be a valid action object/);
});
