/**
 * AgentShield Risk Engine (Step 2B)
 *
 * Evaluates normalized actions using deterministic scoring rules and assigns
 * a risk score (0–100), risk level (LOW, MEDIUM, HIGH, CRITICAL), and a transparent
 * list of contributing risk factors.
 */

/**
 * Risk level categories based on score ranges:
 * - 0–29: LOW
 * - 30–59: MEDIUM
 * - 60–79: HIGH
 * - 80–100: CRITICAL
 */
export const RISK_LEVELS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

/**
 * Maps a numeric risk score (0–100) to its corresponding risk level category.
 *
 * @param {number} score - The capped risk score between 0 and 100.
 * @returns {string} The risk level ('LOW', 'MEDIUM', 'HIGH', or 'CRITICAL').
 */
export function getRiskLevel(score) {
  if (score >= 80) return RISK_LEVELS.CRITICAL;
  if (score >= 60) return RISK_LEVELS.HIGH;
  if (score >= 30) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}

/**
 * Calculates a deterministic risk assessment for a normalized action.
 *
 * Scoring Rules:
 * 1. Scope: action.parameters.count contributes min(count, 100) points.
 *    If count is absent (undefined), contributes 0 points.
 *    If count is present, it must be a non-negative integer; otherwise throws an Error.
 * 2. Destructive operation: if action.operation, case-insensitively, contains 'delete', add 80 points.
 * 3. External destination: if action.parameters.destination is 'external', case-insensitively, add 20 points.
 * 4. Sensitive data: if action.parameters.dataClassification is 'PII' or 'FINANCIAL', case-insensitively, add 5 points.
 * 5. Irreversibility: if action.parameters.irreversible === true, add 20 points.
 *
 * Capping:
 * The final sum is capped to a maximum of 100.
 *
 * Guarantees:
 * - Pure function: does not mutate the input or perform any database, network, or tool operations.
 * - Deterministic: identical actions always return identical assessments.
 * - Transparent: returned score equals the capped sum of the returned factors.
 *
 * @param {object} action - A normalized action object created with createAction().
 * @returns {{ score: number, level: string, factors: Array<{ name: string, points: number }> }}
 */
export function calculateRisk(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new TypeError("Action must be a valid action object.");
  }

  const factors = [];
  const params = action.parameters || {};

  // 1. Scope: action.parameters.count contributes min(count, 100) points
  if (params.count !== undefined) {
    const count = params.count;
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      throw new Error(
        `Invalid count parameter: count must be a non-negative integer. Received: ${typeof count === "number" ? count : JSON.stringify(count)}`
      );
    }

    const scopePoints = Math.min(count, 100);
    if (scopePoints > 0) {
      factors.push({
        name: "Scope",
        points: scopePoints,
      });
    }
  }

  // 2. Destructive operation: if action.operation contains 'delete' (case-insensitive)
  if (
    typeof action.operation === "string" &&
    action.operation.toLowerCase().includes("delete")
  ) {
    factors.push({
      name: "Destructive operation",
      points: 80,
    });
  }

  // 3. External destination: if action.parameters.destination is 'external' (case-insensitive)
  if (
    typeof params.destination === "string" &&
    params.destination.trim().toLowerCase() === "external"
  ) {
    factors.push({
      name: "External destination",
      points: 20,
    });
  }

  // 4. Sensitive data: if action.parameters.dataClassification is 'PII' or 'FINANCIAL' (case-insensitive)
  if (typeof params.dataClassification === "string") {
    const classification = params.dataClassification.trim().toUpperCase();
    if (classification === "PII" || classification === "FINANCIAL") {
      factors.push({
        name: "Sensitive data",
        points: 5,
      });
    }
  }

  // 5. Irreversibility: if action.parameters.irreversible === true
  if (params.irreversible === true) {
    factors.push({
      name: "Irreversibility",
      points: 20,
    });
  }

  // Cap final sum to a maximum of 100
  const rawSum = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.min(100, rawSum);
  const level = getRiskLevel(score);

  return {
    score,
    level,
    factors,
  };
}
