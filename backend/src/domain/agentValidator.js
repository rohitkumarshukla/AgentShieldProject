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

/**
 * Validates input for updating an existing agent.
 *
 * @param {any} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUpdateAgentInput(input) {
  const errors = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errors: ["Update payload must be a non-empty JSON object"],
    };
  }

  const allowedFields = ["name", "description", "status", "environment", "metadata"];
  const providedFields = Object.keys(input);

  if (providedFields.length === 0) {
    return {
      valid: false,
      errors: ["At least one field to update must be provided"],
    };
  }

  const unknownFields = providedFields.filter((f) => !allowedFields.includes(f));
  if (unknownFields.length > 0) {
    errors.push(`Unsupported update fields: ${unknownFields.join(", ")}`);
  }

  // 1. name (optional on update)
  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim().length === 0) {
      errors.push("Agent name must be a non-empty string");
    }
  }

  // 2. status (optional on update)
  if (input.status !== undefined && input.status !== null) {
    if (typeof input.status !== "string" || !VALID_STATUSES.has(input.status.trim())) {
      errors.push(`Invalid status "${input.status}". Allowed values: ${Array.from(VALID_STATUSES).join(", ")}`);
    }
  }

  // 3. environment (optional on update)
  if (input.environment !== undefined && input.environment !== null) {
    if (typeof input.environment !== "string" || !VALID_ENVIRONMENTS.has(input.environment.trim())) {
      errors.push(`Invalid environment "${input.environment}". Allowed values: ${Array.from(VALID_ENVIRONMENTS).join(", ")}`);
    }
  }

  // 4. metadata (optional on update)
  if (input.metadata !== undefined && input.metadata !== null) {
    if (typeof input.metadata !== "object" || Array.isArray(input.metadata)) {
      errors.push("Metadata must be a plain object");
    }
  }

  // 5. description (optional on update)
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      errors.push("Description must be a string or null");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes input for agent updates.
 *
 * @param {Object} input
 * @returns {Object}
 */
export function normalizeUpdateAgentInput(input = {}) {
  const updates = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.description !== undefined) {
    updates.description = typeof input.description === "string" ? input.description.trim() : null;
  }
  if (input.status !== undefined) updates.status = input.status.trim();
  if (input.environment !== undefined) updates.environment = input.environment.trim();
  if (input.metadata !== undefined) {
    updates.metadata = typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : input.metadata;
  }
  updates.updated_at = new Date().toISOString();
  return updates;
}

/**
 * Validates agent permissions payload.
 *
 * @param {any} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePermissionsInput(input) {
  const errors = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errors: ["Permissions payload must be a JSON object"],
    };
  }

  // allowedTools (optional array of strings)
  if (input.allowedTools !== undefined && input.allowedTools !== null) {
    if (!Array.isArray(input.allowedTools) || input.allowedTools.some((t) => typeof t !== "string")) {
      errors.push("allowedTools must be an array of string tool names");
    }
  }

  // blockedOperations (optional array of strings)
  if (input.blockedOperations !== undefined && input.blockedOperations !== null) {
    if (!Array.isArray(input.blockedOperations) || input.blockedOperations.some((t) => typeof t !== "string")) {
      errors.push("blockedOperations must be an array of string operation names");
    }
  }

  // maxFinancialLimit (optional non-negative number)
  if (input.maxFinancialLimit !== undefined && input.maxFinancialLimit !== null) {
    if (typeof input.maxFinancialLimit !== "number" || Number.isNaN(input.maxFinancialLimit) || input.maxFinancialLimit < 0) {
      errors.push("maxFinancialLimit must be a non-negative number");
    }
  }

  // requiresApprovalThreshold (optional number 0-100)
  if (input.requiresApprovalThreshold !== undefined && input.requiresApprovalThreshold !== null) {
    if (typeof input.requiresApprovalThreshold !== "number" || Number.isNaN(input.requiresApprovalThreshold) || input.requiresApprovalThreshold < 0 || input.requiresApprovalThreshold > 100) {
      errors.push("requiresApprovalThreshold must be a number between 0 and 100");
    }
  }

  // environmentRestrictions (optional array of valid environment strings)
  if (input.environmentRestrictions !== undefined && input.environmentRestrictions !== null) {
    if (!Array.isArray(input.environmentRestrictions) || input.environmentRestrictions.some((e) => typeof e !== "string" || !VALID_ENVIRONMENTS.has(e))) {
      errors.push(`environmentRestrictions must be an array containing valid environments: ${Array.from(VALID_ENVIRONMENTS).join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes permissions input into standard schema.
 *
 * @param {Object} input
 * @returns {Object}
 */
export function normalizePermissionsInput(input = {}) {
  return {
    allowedTools: Array.isArray(input.allowedTools) ? [...input.allowedTools] : ["*"],
    blockedOperations: Array.isArray(input.blockedOperations) ? [...input.blockedOperations] : [],
    maxFinancialLimit: typeof input.maxFinancialLimit === "number" ? input.maxFinancialLimit : null,
    requiresApprovalThreshold: typeof input.requiresApprovalThreshold === "number" ? input.requiresApprovalThreshold : 60,
    environmentRestrictions: Array.isArray(input.environmentRestrictions) ? [...input.environmentRestrictions] : ["development", "staging", "production"],
    customPolicies: Array.isArray(input.customPolicies) ? [...input.customPolicies] : (input.customPolicies && typeof input.customPolicies === "object" ? { ...input.customPolicies } : []),
    updatedAt: new Date().toISOString(),
  };
}
