import assert from "node:assert/strict";
import test from "node:test";

import type { Action } from "../../types/action.js";
import { RiskEngine } from "./risk.engine.js";

const engine = new RiskEngine();

const action = (overrides: Partial<Action> = {}): Action => ({
  id: "action-1",
  agentId: "agent-1",
  toolId: "tool-1",
  type: "read customer",
  target: { resource: "customer" },
  parameters: {},
  timestamp: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

test("marks Delete 147 CRM customers as critical through generic rules", () => {
  const assessment = engine.evaluate(action({
    type: "Delete 147 CRM customers",
  }));

  assert.equal(assessment.score, 100);
  assert.equal(assessment.level, "CRITICAL");
  assert.deepEqual(assessment.factors.map(({ factor, points }) => ({ factor, points })), [
    { factor: "DESTRUCTIVE_ACTION", points: 50 },
    { factor: "BULK_SCOPE", points: 55 },
  ]);
});

test("recognizes external, sensitive, production, and financial risk", () => {
  const assessment = engine.evaluate(action({
    type: "export report",
    metadata: {
      destination: "external",
      sensitive: true,
      environment: "production",
      amount: 15_000,
    },
  }));

  assert.equal(assessment.score, 90);
  assert.equal(assessment.level, "CRITICAL");
  assert.equal(assessment.factors.length, 4);
});

test("returns a deterministic low-risk assessment when no rules match", () => {
  const input = action();

  assert.deepEqual(engine.evaluate(input), engine.evaluate(input));
  assert.deepEqual(engine.evaluate(input), { score: 0, level: "LOW", factors: [] });
});
