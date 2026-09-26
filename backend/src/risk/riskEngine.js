import { validateAction } from "../domain/actionValidator.js";

/**
 * Deterministic, explainable Risk Engine for AgentShield.
 *
 * Architecture:
 *   Action -> RiskEngine.evaluate(action) -> RiskAssessment
 *
 * Responsibilities:
 * - Accepts a canonical Action object.
 * - Validates that the input is a valid action object.
 * - Evaluates individual, independent risk scoring rules.
 * - Accumulates explainable risk factors in strict canonical order.
 * - Computes a clamped risk score (0 - 100) while preserving original factor points.
 * - Deterministically maps the clamped score to a discrete RiskLevel.
 *
 * Note: Contains NO policy decisions (ALLOW, BLOCK, REQUIRE_APPROVAL).
 */
export class RiskEngine {
  /**
   * Evaluates an action and returns a deterministic RiskAssessment.
   *
   * @param {Object} action - The action object to evaluate
   * @returns {{
   *   score: number,
   *   level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
   *   factors: Array<{ code: string, description: string, points: number }>
   * }}
   */
  evaluate(action) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw new Error("RiskEngine.evaluate requires a valid action object");
    }

    const validation = validateAction(action);
    if (!validation.valid) {
      throw new Error(
        `RiskEngine.evaluate requires a valid action object: ${validation.errors.join("; ")}`,
      );
    }

    const factors = [];

    // 1. DESTRUCTIVE_ACTION
    // Evaluates whether the action performs a permanent deletion
    if (action.actionType === "delete") {
      factors.push({
        code: "DESTRUCTIVE_ACTION",
        description: "Delete action is inherently destructive",
        points: 50,
      });
    }

    // 2. BULK_SCOPE
    // Evaluates the scope volume affected, picking only the single highest matching tier
    const count = typeof action.scope?.count === "number" ? action.scope.count : 0;
    if (count >= 100) {
      factors.push({
        code: "BULK_SCOPE_CRITICAL",
        description: "Action affects 100 or more resources",
        points: 55,
      });
    } else if (count >= 25) {
      factors.push({
        code: "BULK_SCOPE_HIGH",
        description: "Action affects 25 or more resources",
        points: 35,
      });
    } else if (count >= 10) {
      factors.push({
        code: "BULK_SCOPE_MEDIUM",
        description: "Action affects 10 or more resources",
        points: 20,
      });
    }

    // 3. EXTERNAL_DESTINATION
    // Evaluates whether data or operations cross outside internal environment boundaries
    if (action.destination?.type === "external") {
      factors.push({
        code: "EXTERNAL_DESTINATION",
        description: "Action sends data or performs an operation outside the internal environment",
        points: 20,
      });
    }

    // 4. SENSITIVE_DATA
    // Evaluates whether sensitive or restricted information is targeted
    const sensitivityLevel = action.sensitivity?.level;
    if (sensitivityLevel === "sensitive" || sensitivityLevel === "restricted") {
      factors.push({
        code: "SENSITIVE_DATA",
        description: "Action involves sensitive or restricted data",
        points: 20,
      });
    }

    // 5. PRODUCTION_ENVIRONMENT
    // Evaluates whether the target environment is live production
    if (action.environment === "production") {
      factors.push({
        code: "PRODUCTION_ENVIRONMENT",
        description: "Action targets the production environment",
        points: 15,
      });
    }

    // 6. FINANCIAL_IMPACT
    // Evaluates estimated monetary impact in INR, selecting only the highest tier
    const financialImpact = typeof action.financialImpact === "number" ? action.financialImpact : 0;
    if (financialImpact >= 10000) {
      factors.push({
        code: "FINANCIAL_IMPACT_CRITICAL",
        description: "Action has a financial impact of ₹10,000 or more",
        points: 35,
      });
    } else if (financialImpact >= 1000) {
      factors.push({
        code: "FINANCIAL_IMPACT_HIGH",
        description: "Action has a financial impact between ₹1,000 and ₹9,999",
        points: 25,
      });
    } else if (financialImpact > 0) {
      factors.push({
        code: "FINANCIAL_IMPACT_LOW",
        description: "Action has a financial impact below ₹1,000",
        points: 10,
      });
    }

    // Sum points across all applicable factors
    const rawScore = factors.reduce((sum, factor) => sum + factor.points, 0);

    // Score is clamped between 0 and 100 without modifying factor point values
    const score = Math.min(100, Math.max(0, rawScore));

    return {
      score,
      level: this._determineLevel(score),
      factors,
    };
  }

  /**
   * Deterministically maps a numeric score to a qualitative RiskLevel.
   *
   * @private
   * @param {number} score - Clamped numeric score (0 - 100)
   * @returns {"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"}
   */
  _determineLevel(score) {
    if (score >= 80) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 20) return "MEDIUM";
    return "LOW";
  }
}
