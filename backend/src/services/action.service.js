/**
 * Action Service for AgentShield.
 *
 * Coordinates raw input validation/normalization with createAction()
 * and delegates to the security interceptor.
 */

import { createAction } from "../domain/action.js";
import { interceptAction } from "../security/interceptor.js";

/**
 * Validates, normalizes, and executes the governance pipeline for an incoming action.
 *
 * @param {object} rawInput - The raw action payload from an API request.
 * @returns {object} The full governance decision and execution result.
 */
export function executeAction(rawInput) {
  // 1. Validate and normalize the action using the existing domain action factory
  const normalizedAction = createAction(rawInput);

  // 2. Delegate to the security interceptor
  return interceptAction(normalizedAction);
}

// Alias for semantic clarity across consumers
export const processAction = executeAction;
