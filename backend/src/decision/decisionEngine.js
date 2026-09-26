import { PolicyEngine } from "../policy/policyEngine.js";
import { RiskEngine } from "../risk/riskEngine.js";

/**
 * Deterministic Decision Engine for AgentShield.
 *
 * Architecture:
 *   Action
 *     ↓
 *   RiskEngine.evaluate(action)
 *     ↓
 *   PolicyEngine.evaluate(action, riskAssessment)
 *     ↓
 *   Combined Decision Result
 *
 * Responsibilities:
 * - Coordinates the evaluation pipeline without duplicating risk or policy logic.
 * - Enforces fail-closed error handling (evaluation failures propagate instead of becoming ALLOW).
 * - Guarantees determinism and preserves input immutability.
 */
export class DecisionEngine {
  /**
   * Initializes the DecisionEngine with optional injected engines.
   *
   * @param {Object} [dependencies={}]
   * @param {RiskEngine} [dependencies.riskEngine] - Injected or default RiskEngine instance
   * @param {PolicyEngine} [dependencies.policyEngine] - Injected or default PolicyEngine instance
   */
  constructor({ riskEngine, policyEngine } = {}) {
    this.riskEngine = riskEngine || new RiskEngine();
    this.policyEngine = policyEngine || new PolicyEngine();
  }

  /**
   * Evaluates an action through the complete governance pipeline.
   *
   * @param {Object} action - The canonical action object to evaluate
   * @returns {{
   *   action: Object,
   *   risk: {
   *     score: number,
   *     level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
   *     factors: Array<{ code: string, description: string, points: number }>
   *   },
   *   policy: {
   *     decision: "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK",
   *     policyCode: string,
   *     reason: string,
   *     requiresHumanApproval: boolean
   *   }
   * }}
   */
  evaluate(action) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw new Error("DecisionEngine.evaluate requires a valid action object");
    }

    // 1. Evaluate risk through the RiskEngine
    const riskAssessment = this.riskEngine.evaluate(action);

    // 2. Evaluate policy through the PolicyEngine
    const policyResult = this.policyEngine.evaluate(action, riskAssessment);

    // 3. Return combined decision result preserving original action reference
    return {
      action,
      risk: {
        score: riskAssessment.score,
        level: riskAssessment.level,
        factors: riskAssessment.factors,
      },
      policy: {
        decision: policyResult.decision,
        policyCode: policyResult.policyCode,
        reason: policyResult.reason,
        requiresHumanApproval: policyResult.requiresHumanApproval,
      },
    };
  }
}
