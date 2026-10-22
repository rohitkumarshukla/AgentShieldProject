/**
 * Security Interceptor for AgentShield (Step 4).
 *
 * Coordinates governance evaluation and conditional tool execution:
 * 1. Receives a normalized action.
 * 2. Evaluates the action through the decision engine.
 * 3. Conditionally delegates to the governed tool executor (only executed if ALLOW).
 * 4. Assembles and returns a consistent governance and execution result.
 */

import { evaluateAction } from "../decision/decisionEngine.js";
import { executeGovernedTool, EXECUTION_STATUS } from "../tools/governedToolExecutor.js";

export { EXECUTION_STATUS };

/**
 * Intercepts an action and coordinates decision evaluation and safe execution.
 *
 * @param {object} action - A normalized action domain model.
 * @returns {{
 *   decision: string,
 *   policyId: string,
 *   reason: string,
 *   riskAssessment: object,
 *   executionStatus: string,
 *   executionResult: any
 * }}
 */
export function interceptAction(action) {
  // 1. Evaluate action through the decision engine (risk + policy)
  const decisionResult = evaluateAction(action);

  // 2. Conditionally execute governed tool only if ALLOW
  const execution = executeGovernedTool(action, decisionResult.decision);

  // 3. Return consistent governance output
  return {
    decision: decisionResult.decision,
    policyId: decisionResult.policyId,
    reason: decisionResult.reason,
    riskAssessment: decisionResult.riskAssessment,
    executionStatus: execution.executionStatus,
    executionResult: execution.executionResult,
  };
}
