/**
 * AgentShield Decision Engine (Step 3)
 *
 * Combines risk assessment and policy evaluation to produce an authoritative governance
 * decision for a proposed action.
 *
 * Guarantees:
 * - Pure and deterministic: Free of database, network, and tool-execution side effects.
 * - Does not mutate input objects.
 * - Fails closed on invalid inputs.
 */

import { calculateRisk } from "../risk/riskEngine.js";
import { evaluatePolicy, DECISIONS, POLICY_IDS } from "../policy/policyEngine.js";

export { DECISIONS, POLICY_IDS };

/**
 * Evaluates an action through the AgentShield risk and policy pipeline.
 *
 * Pipeline steps:
 * 1. Calculate deterministic risk score, level, and factors via calculateRisk(action).
 * 2. Evaluate governance policy rules via evaluatePolicy(action, riskAssessment).
 * 3. Return combined result with decision, riskAssessment, policyId, and reason.
 *
 * @param {object} action - Normalized action object created with createAction().
 * @returns {{ decision: string, policyId: string, reason: string, riskAssessment: object }}
 */
export function evaluateAction(action) {
  // 1. Calculate risk assessment using the existing risk engine
  const riskAssessment = calculateRisk(action);

  // 2. Evaluate applicable governance policies
  const policyResult = evaluatePolicy(action, riskAssessment);

  // 3. Return combined authoritative governance result
  return {
    decision: policyResult.decision,
    policyId: policyResult.policyId,
    reason: policyResult.reason,
    riskAssessment,
  };
}
