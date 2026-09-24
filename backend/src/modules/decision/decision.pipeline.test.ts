import assert from "node:assert/strict";
import test from "node:test";

import type { Action } from "../../types/action.js";
import { DEFAULT_POLICIES, PolicyEngine } from "../policies/policy.engine.js";
import { RiskEngine } from "../risk/risk.engine.js";
import { DecisionPipeline } from "./decision.pipeline.js";

const pipeline = new DecisionPipeline();

const createAction = (overrides: Partial<Action> = {}): Action => ({
  id: "action-1",
  agentId: "agent-1",
  toolId: "tool-1",
  type: "read internal knowledge articles",
  target: { resource: "knowledge-article" },
  parameters: {},
  timestamp: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

// Test 1 — Critical destructive bulk delete
test("Test 1 — Critical destructive bulk delete (Delete 147 CRM customers -> BLOCK)", () => {
  const action = createAction({
    type: "Delete 147 CRM customers",
  });

  const decision = pipeline.evaluate(action);

  // Verify RiskEngine produced 100 / CRITICAL without pipeline hardcoding
  assert.equal(decision.riskAssessment.score, 100);
  assert.equal(decision.riskAssessment.level, "CRITICAL");
  assert.deepEqual(
    decision.riskAssessment.factors.map(({ factor, points }) => ({ factor, points })),
    [
      { factor: "DESTRUCTIVE_ACTION", points: 50 },
      { factor: "BULK_SCOPE", points: 55 },
    ],
  );

  // Verify PolicyEngine matched bulk_delete_guard
  assert.equal(decision.policyEvaluation.selectedPolicy?.id, "bulk_delete_guard");

  // Verify DecisionPipeline final outcome is BLOCK
  assert.equal(decision.finalOutcome, "BLOCK");
  assert.equal(decision.reason, "Destructive actions affecting a large scope are blocked");
  assert.equal(decision.action, action);
});

// Test 2 — External email
test("Test 2 — External email (Send follow-up emails to 38 leads -> REQUIRE_APPROVAL)", () => {
  const action = createAction({
    type: "Send follow-up emails to 38 leads",
    metadata: { recipientType: "external" },
    parameters: { recipients: 38 },
  });

  const decision = pipeline.evaluate(action);

  assert.equal(decision.policyEvaluation.selectedPolicy?.id, "external_email_review");
  assert.equal(decision.finalOutcome, "REQUIRE_APPROVAL");
  assert.equal(decision.reason, "Messages sent to external recipients require approval");
});

// Test 3 — Internal read
test("Test 3 — Internal read (Read 12 internal knowledge articles -> ALLOW)", () => {
  const action = createAction({
    type: "Read 12 internal knowledge articles",
  });

  const decision = pipeline.evaluate(action);

  assert.equal(decision.policyEvaluation.selectedPolicy?.id, "internal_read_allow");
  assert.equal(decision.finalOutcome, "ALLOW");
  assert.equal(decision.reason, "Explicit low-risk internal reads are allowed");
});

// Test 4 — Sensitive external export
test("Test 4 — Sensitive external export (triggers sensitive_export_guard -> BLOCK)", () => {
  const action = createAction({
    type: "Export customer records",
    metadata: { sensitive: true },
  });

  const decision = pipeline.evaluate(action);

  assert.equal(decision.policyEvaluation.selectedPolicy?.id, "sensitive_export_guard");
  assert.equal(decision.finalOutcome, "BLOCK");
  assert.equal(decision.reason, "Exports containing sensitive data are blocked");
});

// Test 5 — Production change
test("Test 5 — Production change (triggers production_change_review -> REQUIRE_APPROVAL)", () => {
  const action = createAction({
    type: "Deploy configuration update",
    metadata: { environment: "production" },
  });

  const decision = pipeline.evaluate(action);

  assert.equal(decision.policyEvaluation.selectedPolicy?.id, "production_change_review");
  assert.equal(decision.finalOutcome, "REQUIRE_APPROVAL");
  assert.equal(decision.reason, "Production-targeted actions require approval");
});

// Test 6 — Financial threshold
test("Test 6 — Financial threshold (triggers financial_threshold_review -> REQUIRE_APPROVAL)", () => {
  // PolicyEngine threshold: requiredRiskFactors: ["FINANCIAL_IMPACT"], minimumFactorPoints: 25 (amount >= 1,000)
  const action = createAction({
    type: "Process customer transfer",
    parameters: { amount: 1_000 },
  });

  const decision = pipeline.evaluate(action);

  assert.equal(decision.policyEvaluation.selectedPolicy?.id, "financial_threshold_review");
  assert.equal(decision.finalOutcome, "REQUIRE_APPROVAL");
  assert.equal(decision.reason, "Financial actions of 1,000 or more require approval");
});

// Test 7 — Unknown action
test("Test 7 — Unknown action follows policy engine default fallback (REQUIRE_APPROVAL)", () => {
  const action = createAction({
    type: "Generate a summary draft",
  });

  const decision = pipeline.evaluate(action);

  assert.equal(decision.policyEvaluation.selectedPolicy, undefined);
  assert.equal(decision.finalOutcome, "REQUIRE_APPROVAL");
  assert.equal(decision.reason, "No explicit policy matched; approval is required by default");
});

// Test 8 — Pipeline preserves policy explanation
test("Test 8 — Pipeline preserves policy explanation exactly as produced by PolicyEngine", () => {
  const action = createAction({
    type: "Delete 147 CRM customers",
  });

  const decision = pipeline.evaluate(action);

  assert.equal(decision.reason, decision.policyEvaluation.reason);
  assert.equal(decision.reason, "Destructive actions affecting a large scope are blocked");
});

// Additional Architectural & Invariance Tests
test("Dependency Injection — accepts injected risk and policy engine instances", () => {
  const customRiskEngine = new RiskEngine();
  const customPolicyEngine = new PolicyEngine();

  const customPipeline = new DecisionPipeline({
    riskEngine: customRiskEngine,
    policyEngine: customPolicyEngine,
    defaultPolicies: DEFAULT_POLICIES,
  });

  const action = createAction({ type: "Read 12 internal knowledge articles" });
  const decision = customPipeline.evaluate(action);

  assert.equal(decision.finalOutcome, "ALLOW");
});

test("Determinism — identical actions evaluated multiple times produce identical results", () => {
  const action = createAction({
    type: "Delete 147 CRM customers",
    metadata: { environment: "production" },
  });

  const result1 = pipeline.evaluate(action);
  const result2 = pipeline.evaluate(action);

  assert.deepEqual(result1, result2);
});

test("Error propagation — engine errors are propagated without swallowing into ALLOW", () => {
  const faultyRiskEngine = {
    evaluate: () => {
      throw new Error("Risk assessment service failure");
    },
  } as unknown as RiskEngine;

  const faultyPipeline = new DecisionPipeline({ riskEngine: faultyRiskEngine });
  const action = createAction({ type: "Read 12 internal knowledge articles" });

  assert.throws(
    () => {
      faultyPipeline.evaluate(action);
    },
    {
      name: "Error",
      message: "Risk assessment service failure",
    },
  );
});
