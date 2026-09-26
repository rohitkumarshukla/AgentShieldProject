/**
 * Regular expression validating a standard 8-4-4-4-12 UUID (RFC 4122).
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_STATUSES = new Set(["active", "inactive"]);
const VALID_ENVIRONMENTS = new Set(["development", "staging", "production"]);

/**
 * Validates whether a given string is a valid UUID format.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isValidUuid(id) {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

/**
 * Validates input for creating a new agent.
 *
 * Requirements:
 * - input must be a non-null plain object
 * - name: required, non-empty trimmed string
 * - status: optional; if provided, must be "active" or "inactive"
 * - environment: optional; if provided, must be "development", "staging", or "production"
 * - metadata: optional; if provided, must be a plain object and not an array
 * - description: optional; if provided, must be a string or null
 *
 * @param {any} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCreateAgentInput(input) {
  const errors = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errors: ["Request body must be a non-empty JSON object"],
    };
  }

  // 1. name (required)
  if (input.name === undefined || input.name === null) {
    errors.push("Agent name is required");
  } else if (typeof input.name !== "string" || input.name.trim().length === 0) {
    errors.push("Agent name must be a non-empty string");
  }

  // 2. status (optional, defaults to "active")
  if (input.status !== undefined && input.status !== null) {
    if (typeof input.status !== "string" || !VALID_STATUSES.has(input.status.trim())) {
      errors.push(`Invalid status "${input.status}". Allowed values: ${Array.from(VALID_STATUSES).join(", ")}`);
    }
  }

  // 3. environment (optional, defaults to "development")
  if (input.environment !== undefined && input.environment !== null) {
    if (typeof input.environment !== "string" || !VALID_ENVIRONMENTS.has(input.environment.trim())) {
      errors.push(`Invalid environment "${input.environment}". Allowed values: ${Array.from(VALID_ENVIRONMENTS).join(", ")}`);
    }
  }

  // 4. metadata (optional, defaults to {})
  if (input.metadata !== undefined && input.metadata !== null) {
    if (typeof input.metadata !== "object" || Array.isArray(input.metadata)) {
      errors.push("Metadata must be a plain object");
    }
  }

  // 5. description (optional)
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      errors.push("Description must be a string if provided");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes input for agent creation, applying schema-consistent defaults.
 *
 * @param {Object} input
 * @returns {Object} Normalized agent creation payload
 */
export function normalizeCreateAgentInput(input = {}) {
  return {
    name: input.name.trim(),
    description: input.description !== undefined && input.description !== null
      ? input.description.trim()
      : null,
    status: input.status !== undefined && input.status !== null
      ? input.status.trim()
      : "active",
    environment: input.environment !== undefined && input.environment !== null
      ? input.environment.trim()
      : "development",
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {},
  };
}
