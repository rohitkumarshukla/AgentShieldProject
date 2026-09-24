import type { Action } from "../../types/action.js";
import type { DecisionResult } from "../../types/decision.js";
import type { Policy } from "../../types/policy.js";
import { DEFAULT_POLICIES, PolicyEngine } from "../policies/policy.engine.js";
import { RiskEngine } from "../risk/risk.engine.js";

export interface DecisionPipelineDependencies {
  riskEngine?: RiskEngine;
  policyEngine?: PolicyEngine;
  defaultPolicies?: readonly Policy[];
}

/**
 * DecisionPipeline orchestrates the deterministic evaluation of an Action through
 * the RiskEngine and PolicyEngine to produce an authoritative governance decision.
 *
 * Sequence:
 *   Action -> RiskEngine -> RiskAssessment -> PolicyEngine -> PolicyEvaluationResult -> DecisionResult
 *
 * The pipeline contains no scoring logic or policy rules of its own. It acts as the
 * orchestration boundary between domain actions and security decisions.
 */
export class DecisionPipeline {
  private readonly riskEngine: RiskEngine;
  private readonly policyEngine: PolicyEngine;
  private readonly defaultPolicies: readonly Policy[];

  constructor(dependencies: DecisionPipelineDependencies = {}) {
    this.riskEngine = dependencies.riskEngine ?? new RiskEngine();
    this.policyEngine = dependencies.policyEngine ?? new PolicyEngine();
    this.defaultPolicies = dependencies.defaultPolicies ?? DEFAULT_POLICIES;
  }

  /**
   * Evaluates an incoming action through the risk and policy engines.
   *
   * @param action The agent action to evaluate
   * @param policies Optional custom policies; defaults to the configured default policies
   * @returns An aggregate DecisionResult containing the full evaluation trace and final outcome
   */
  evaluate(action: Action, policies?: readonly Policy[]): DecisionResult {
    // 1. Evaluate risk using the deterministic RiskEngine
    const riskAssessment = this.riskEngine.evaluate(action);

    // 2. Evaluate policies against the action and risk assessment
    const activePolicies = policies ?? this.defaultPolicies;
    const policyEvaluation = this.policyEngine.evaluate(action, riskAssessment, activePolicies);

    // 3. Assemble and return the final aggregate decision result.
    // The final outcome and reasoning are determined directly by the PolicyEngine.
    return {
      action,
      riskAssessment,
      policyEvaluation,
      finalOutcome: policyEvaluation.outcome,
      reason: policyEvaluation.reason,
    };
  }
}
