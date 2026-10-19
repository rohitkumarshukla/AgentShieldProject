import { validateAction } from "./actionValidator.js";

/**
 * Creates a normalized Action domain model object.
 *
 * Requirements:
 * - Validates input using validateAction().
 * - Throws a descriptive Error if validation fails.
 * - Trims surrounding whitespace from required string fields (agentId, toolId, operation).
 * - Applies documented defaults:
 *   - parameters: {}
 *   - environment: 'development'
 *   - userPrompt: ''
 * - Returns only defined action fields without generating random values, IDs, or timestamps.
 *
 * @param {object} input - The raw action input data.
 * @returns {object} The normalized action domain object.
 */
export function createAction(input) {
  const validation = validateAction(input);

  if (!validation.valid) {
    const errorDetails = validation.errors.join("; ");
    throw new Error(`Action validation failed: ${errorDetails}`);
  }

  return {
    agentId: input.agentId.trim(),
    toolId: input.toolId.trim(),
    operation: input.operation.trim(),
    parameters: input.parameters !== undefined ? { ...input.parameters } : {},
    environment: input.environment !== undefined ? input.environment : "development",
    userPrompt: input.userPrompt !== undefined ? input.userPrompt : "",
  };
}
