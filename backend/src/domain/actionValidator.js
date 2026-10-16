/**
 * Allowed environments for an action execution.
 */
export const ALLOWED_ENVIRONMENTS = Object.freeze([
  "development",
  "staging",
  "production",
]);

/**
 * Validates an incoming action payload.
 *
 * Rules:
 * - input: must be a plain object (not null, not an array, not a primitive).
 * - agentId: required, non-empty string.
 * - toolId: required, non-empty string.
 * - operation: required, non-empty string.
 * - parameters: optional plain object (defaults to {} if omitted).
 * - environment: optional string restricted to 'development', 'staging', or 'production' (defaults to 'development').
 * - userPrompt: optional string (defaults to '' if omitted).
 *
 * This function does not modify the input object.
 *
 * @param {unknown} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAction(input) {
  const errors = [];

  // Verify that the payload is a valid non-null plain object (not an array)
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errors: ["Action payload must be a plain object."],
    };
  }

  // 1. Validate agentId (required, non-empty string)
  if (input.agentId === undefined || input.agentId === null) {
    errors.push("agentId is required.");
  } else if (typeof input.agentId !== "string") {
    errors.push("agentId must be a string.");
  } else if (input.agentId.trim().length === 0) {
    errors.push("agentId cannot be empty or whitespace-only.");
  }

  // 2. Validate toolId (required, non-empty string)
  if (input.toolId === undefined || input.toolId === null) {
    errors.push("toolId is required.");
  } else if (typeof input.toolId !== "string") {
    errors.push("toolId must be a string.");
  } else if (input.toolId.trim().length === 0) {
    errors.push("toolId cannot be empty or whitespace-only.");
  }

  // 3. Validate operation (required, non-empty string)
  if (input.operation === undefined || input.operation === null) {
    errors.push("operation is required.");
  } else if (typeof input.operation !== "string") {
    errors.push("operation must be a string.");
  } else if (input.operation.trim().length === 0) {
    errors.push("operation cannot be empty or whitespace-only.");
  }

  // 4. Validate parameters (optional plain object)
  if (input.parameters !== undefined) {
    if (
      typeof input.parameters !== "object" ||
      input.parameters === null ||
      Array.isArray(input.parameters)
    ) {
      errors.push("parameters must be a plain object if provided.");
    }
  }

  // 5. Validate environment (optional string restricted to allowed list)
  if (input.environment !== undefined) {
    if (typeof input.environment !== "string") {
      errors.push("environment must be a string.");
    } else if (!ALLOWED_ENVIRONMENTS.includes(input.environment)) {
      errors.push(
        `environment must be one of: ${ALLOWED_ENVIRONMENTS.join(", ")}.`
      );
    }
  }

  // 6. Validate userPrompt (optional string)
  if (input.userPrompt !== undefined) {
    if (typeof input.userPrompt !== "string") {
      errors.push("userPrompt must be a string if provided.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
