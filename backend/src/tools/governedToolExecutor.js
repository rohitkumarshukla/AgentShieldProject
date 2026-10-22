/**
 * Governed Tool Executor for AgentShield.
 *
 * Guarantees:
 * - Never calls a tool handler unless the governance decision is strictly ALLOW.
 * - If decision is APPROVAL_REQUIRED, returns PENDING_APPROVAL without executing.
 * - If decision is BLOCK, returns PREVENTED without executing.
 * - If decision is ALLOW but the tool or operation is unknown/unregistered,
 *   fails closed and returns UNSUPPORTED_TOOL without executing.
 */

import { getToolHandler } from "./toolRegistry.js";
import { DECISIONS } from "../policy/policyEngine.js";

export const EXECUTION_STATUS = Object.freeze({
  EXECUTED: "EXECUTED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  PREVENTED: "PREVENTED",
  UNSUPPORTED_TOOL: "UNSUPPORTED_TOOL",
});

/**
 * Conditionally executes a tool handler under governance rules.
 *
 * @param {object} action - Normalized action domain model.
 * @param {string} decision - Final governance decision (ALLOW, APPROVAL_REQUIRED, BLOCK).
 * @returns {{
 *   executed: boolean,
 *   executionStatus: string,
 *   executionResult: any
 * }}
 */
export function executeGovernedTool(action, decision) {
  // 1. Blocked action -> never execute
  if (decision === DECISIONS.BLOCK) {
    return {
      executed: false,
      executionStatus: EXECUTION_STATUS.PREVENTED,
      executionResult: null,
    };
  }

  // 2. Pending human approval -> never execute
  if (decision === DECISIONS.APPROVAL_REQUIRED) {
    return {
      executed: false,
      executionStatus: EXECUTION_STATUS.PENDING_APPROVAL,
      executionResult: null,
    };
  }

  // 3. Strict guard: only proceed if decision is exactly ALLOW
  if (decision !== DECISIONS.ALLOW) {
    return {
      executed: false,
      executionStatus: EXECUTION_STATUS.PREVENTED,
      executionResult: null,
    };
  }

  // 4. Verify tool is registered (fail-closed guard for unknown tools)
  const handler = getToolHandler(action.toolId, action.operation);
  if (!handler) {
    return {
      executed: false,
      executionStatus: EXECUTION_STATUS.UNSUPPORTED_TOOL,
      executionResult: null,
    };
  }

  // 5. Execute allowed tool safely
  const result = handler(action);
  return {
    executed: true,
    executionStatus: EXECUTION_STATUS.EXECUTED,
    executionResult: result,
  };
}
