const SUPPORTED_ACTION_TYPES = new Set([
  "read",
  "write",
  "delete",
  "send",
  "execute",
  "export",
]);

const SUPPORTED_SCOPE_TYPES = new Set([
  "single",
  "bulk",
  "all",
]);

const SUPPORTED_DESTINATION_TYPES = new Set([
  "internal",
  "external",
  "none",
]);

const SUPPORTED_ENVIRONMENTS = new Set([
  "development",
  "staging",
  "production",
]);

const SUPPORTED_SENSITIVITY_LEVELS = new Set([
  "public",
  "internal",
  "sensitive",
  "restricted",
]);

/**
 * Validates an action object deterministically against AgentShield domain rules.
 *
 * Does not throw exceptions; instead returns structured success/failure details
 * so the caller can handle invalid actions safely without try/catch overhead.
 *
 * @param {unknown} action - The action object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAction(action) {
  const errors = [];

  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return {
      valid: false,
      errors: ["Action must be a valid non-null object."],
    };
  }

  // agentId: required non-empty string
  if (typeof action.agentId !== "string" || action.agentId.trim().length === 0) {
    errors.push("agentId is required and must be a non-empty string.");
  }

  // actionType: must be one of the supported types
  if (typeof action.actionType !== "string" || !SUPPORTED_ACTION_TYPES.has(action.actionType)) {
    errors.push(
      `actionType must be one of: ${Array.from(SUPPORTED_ACTION_TYPES).join(", ")}.`,
    );
  }

  // target: required non-empty string
  if (typeof action.target !== "string" || action.target.trim().length === 0) {
    errors.push("target is required and must be a non-empty string.");
  }

  // description: required non-empty string
  if (typeof action.description !== "string" || action.description.trim().length === 0) {
    errors.push("description is required and must be a non-empty string.");
  }

  // scope: object with valid type and non-negative count
  if (!action.scope || typeof action.scope !== "object" || Array.isArray(action.scope)) {
    errors.push("scope must be an object with 'type' and 'count'.");
  } else {
    if (!SUPPORTED_SCOPE_TYPES.has(action.scope.type)) {
      errors.push(`scope.type must be one of: ${Array.from(SUPPORTED_SCOPE_TYPES).join(", ")}.`);
    }
    if (typeof action.scope.count !== "number" || Number.isNaN(action.scope.count) || action.scope.count < 0) {
      errors.push("scope.count must be a non-negative number.");
    }
  }

  // destination: object with valid type and string | null value
  if (!action.destination || typeof action.destination !== "object" || Array.isArray(action.destination)) {
    errors.push("destination must be an object with 'type' and optional 'value'.");
  } else {
    if (!SUPPORTED_DESTINATION_TYPES.has(action.destination.type)) {
      errors.push(
        `destination.type must be one of: ${Array.from(SUPPORTED_DESTINATION_TYPES).join(", ")}.`,
      );
    }
    if (
      action.destination.value !== null &&
      action.destination.value !== undefined &&
      typeof action.destination.value !== "string"
    ) {
      errors.push("destination.value must be a string or null.");
    }
  }

  // environment: must be one of the supported environments
  if (typeof action.environment !== "string" || !SUPPORTED_ENVIRONMENTS.has(action.environment)) {
    errors.push(
      `environment must be one of: ${Array.from(SUPPORTED_ENVIRONMENTS).join(", ")}.`,
    );
  }

  // sensitivity: object with valid level
  if (!action.sensitivity || typeof action.sensitivity !== "object" || Array.isArray(action.sensitivity)) {
    errors.push("sensitivity must be an object with 'level'.");
  } else if (!SUPPORTED_SENSITIVITY_LEVELS.has(action.sensitivity.level)) {
    errors.push(
      `sensitivity.level must be one of: ${Array.from(SUPPORTED_SENSITIVITY_LEVELS).join(", ")}.`,
    );
  }

  // financialImpact: must be a non-negative number
  if (
    typeof action.financialImpact !== "number" ||
    Number.isNaN(action.financialImpact) ||
    action.financialImpact < 0
  ) {
    errors.push("financialImpact must be a non-negative number.");
  }

  // metadata: must be an object if present
  if (!action.metadata || typeof action.metadata !== "object" || Array.isArray(action.metadata)) {
    errors.push("metadata must be an object.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
