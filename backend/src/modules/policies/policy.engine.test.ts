import assert from "node:assert/strict";
import test from "node:test";

import type { Action } from "../../types/action.js";
import { RiskEngine } from "../risk/risk.engine.js";
import { DEFAULT_POLICIES, PolicyEngine } from "./policy.engine.js";

const riskEngine = new RiskEngine();
const policyEngine = new PolicyEngine();

const action = (overrides: Partial<Action> = {}): Action => ({
  id: "action-1",
  agentId: "agent-1",
  toolId: "tool-1",
  type: "read internal knowledge articles",
  target: { resource: "knowledge-article" },
  parameters: {},
  timestamp: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const evaluate = (input: Action) => policyEngine.evaluate(input, riskEngine.evaluate(input), DEFAULT_POLICIES);

test("blocks a generic large bulk deletion", () => {
  const result = evaluate(action({ type: "Delete 147 CRM customers" }));
  assert.equal(result.outcome, "BLOCK");
  assert.equal(result.selectedPolicy?.id, "bulk_delete_guard");
});

test("requires approval for external email", () => {
  const result = evaluate(action({
    type: "Send follow-up emails",
    metadata: { recipientType: "external" },
    parameters: { recipients: 38 },
  }));
  assert.equal(result.outcome, "REQUIRE_APPROVAL");
  assert.equal(result.selectedPolicy?.id, "external_email_review");
});

test("blocks a sensitive export", () => {
  const result = evaluate(action({ type: "Export customer data", metadata: { sensitive: true } }));
  assert.equal(result.outcome, "BLOCK");
  assert.equal(result.selectedPolicy?.id, "sensitive_export_guard");
});

test("requires approval for a production infrastructure action", () => {
  const result = evaluate(action({ type: "Restart infrastructure", metadata: { environment: "production" } }));
  assert.equal(result.outcome, "REQUIRE_APPROVAL");
  assert.equal(result.selectedPolicy?.id, "production_change_review");
});

test("requires approval for a financial action at the threshold", () => {
  const result = evaluate(action({ type: "Issue refund", parameters: { refundAmount: 1_000 } }));
  assert.equal(result.outcome, "REQUIRE_APPROVAL");
  assert.equal(result.selectedPolicy?.id, "financial_threshold_review");
});

test("allows an explicit low-risk internal read", () => {
  const result = evaluate(action({ type: "Read 12 internal knowledge articles" }));
  assert.equal(result.outcome, "ALLOW");
  assert.equal(result.selectedPolicy?.id, "internal_read_allow");
});

test("requires approval for an unknown action", () => {
  const result = evaluate(action({ type: "Generate a draft summary" }));
  assert.equal(result.outcome, "REQUIRE_APPROVAL");
  assert.equal(result.selectedPolicy, undefined);
});

test("uses block precedence and policy priority for conflicts", () => {
  const result = evaluate(action({
    type: "Delete and export customer records",
    parameters: { records: 147 },
    metadata: { sensitive: true },
  }));
  assert.equal(result.outcome, "BLOCK");
  assert.equal(result.selectedPolicy?.id, "sensitive_export_guard");
  assert.deepEqual(result.matchedPolicies.map((policy) => policy.id), [
    "sensitive_export_guard",
    "bulk_delete_guard",
  ]);
  assert.equal(result.reason, "Exports containing sensitive data are blocked");
});
