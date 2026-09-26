import { RiskEngine } from "./riskEngine.js";
import { createAction } from "../domain/action.js";
import { validateAction } from "../domain/actionValidator.js";

export class RiskServiceError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=400]
   * @param {string} [code='INVALID_RISK_EVALUATION']
   * @param {Object} [details={}]
   */
  constructor(message, statusCode = 400, code = "INVALID_RISK_EVALUATION", details = {}) {
    super(message);
    this.name = "RiskServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Risk Band Threshold Definitions (aligned with PRD & UI).
 */
export const RISK_BANDS = Object.freeze({
  LOW: Object.freeze({
    level: "LOW",
    min: 0,
    max: 29,
    defaultDecision: "ALLOW",
    description: "Low-impact action eligible for automatic allow under policy without human friction.",
  }),
  MEDIUM: Object.freeze({
    level: "MEDIUM",
    min: 30,
    max: 59,
    defaultDecision: "APPROVAL_REQUIRED",
    description: "Medium-impact action; policy evaluates whether to auto-allow or pause for human approval.",
  }),
  HIGH: Object.freeze({
    level: "HIGH",
    min: 60,
    max: 79,
    defaultDecision: "APPROVAL_REQUIRED",
    description: "High-impact action requiring mandatory human review and verification before execution.",
  }),
  CRITICAL: Object.freeze({
    level: "CRITICAL",
    min: 80,
    max: 100,
    defaultDecision: "BLOCK",
    description: "Destructive or catastrophic-risk action blocked before execution or requiring elevated authorization.",
  }),
});

/**
 * Maps a numeric score (0-100) to its standardized Risk Band.
 *
 * @param {number} score
 * @returns {typeof RISK_BANDS[keyof typeof RISK_BANDS]}
 */
export function getRiskBand(score) {
  const clamped = Math.min(100, Math.max(0, Number(score) || 0));
  if (clamped >= 80) return RISK_BANDS.CRITICAL;
  if (clamped >= 60) return RISK_BANDS.HIGH;
  if (clamped >= 30) return RISK_BANDS.MEDIUM;
  return RISK_BANDS.LOW;
}

/**
 * Generates an explainable human-readable summary of risk factors.
 *
 * @param {{ score: number, level: string, factors: Array<{ code: string, description: string, points: number }> }} assessment
 * @returns {string}
 */
export function explainRiskAssessment(assessment) {
  try {
    if (!assessment || typeof assessment !== "object") {
      return "No risk assessment available.";
    }

    const { score = 0, level = "LOW", factors = [] } = assessment;
    if (factors.length === 0) {
      return `Risk score is ${score}/100 (${level}). No elevated risk factors identified.`;
    }

    const factorDescriptions = factors.map((f) => `${f.description} (+${f.points} pts)`).join("; ");
    return `Risk score is ${score}/100 (${level}) driven by ${factors.length} factor(s): ${factorDescriptions}.`;
  } catch (_error) {
    return "Unable to format risk explanation.";
  }
}

/**
 * Translates raw tool call parameters into standard Action risk attributes.
 *
 * @param {Object} toolCall
 * @param {string} toolCall.toolId
 * @param {string} toolCall.operation
 * @param {Object} [toolCall.parameters={}]
 * @param {string} [toolCall.environment='development']
 * @param {string} [toolCall.agentId]
 * @returns {Object} Canonical Action payload
 */
export function mapToolCallToAction(toolCall = {}) {
  try {
    const {
      toolId = "",
      operation = "",
      parameters = {},
      environment = "development",
      agentId = "00000000-0000-0000-0000-000000000000",
      target,
      description,
    } = toolCall;

    const normTool = String(toolId).toLowerCase();
    const normOp = String(operation).toLowerCase();

    // 1. Detect Action Type (delete, write, read, execute)
    let actionType = "read";
    if (normOp.includes("delete") || normOp.includes("drop") || normOp.includes("destroy") || normOp.includes("purge")) {
      actionType = "delete";
    } else if (normOp.includes("create") || normOp.includes("update") || normOp.includes("write") || normOp.includes("send") || normOp.includes("reverse")) {
      actionType = "write";
    } else if (normOp.includes("restart") || normOp.includes("scale") || normOp.includes("exec")) {
      actionType = "execute";
    }

    // 2. Detect Scope Count (records affected)
    const count = Number(
      parameters?.count ||
      parameters?.recipientCount ||
      parameters?.records ||
      parameters?.limit ||
      parameters?.batchSize ||
      1
    );

    // 3. Detect Destination (external vs internal)
    const isExternal =
      normTool.includes("email") ||
      normTool.includes("comms") ||
      normTool.includes("export") ||
      normOp.includes("send") ||
      normOp.includes("export") ||
      parameters?.external === true;

    // 4. Detect Sensitivity Level (sensitive/restricted vs public/internal)
    const isSensitive =
      normTool.includes("export") ||
      normTool.includes("crm") ||
      normTool.includes("finance") ||
      normTool.includes("ledger") ||
      normOp.includes("export") ||
      normOp.includes("credential") ||
      normOp.includes("password");

    // 5. Detect Financial Impact (in INR)
    const financialImpact = Number(
      parameters?.amount ||
      parameters?.value ||
      parameters?.financialImpact ||
      0
    );

    return createAction({
      agentId: agentId || "00000000-0000-0000-0000-000000000000",
      tool: toolId,
      actionType,
      target: toolCall.target || `${toolId}.${operation}`,
      description: toolCall.description || `Tool invocation: ${toolId} -> ${operation}`,
      environment,
      scope: { count: Number.isFinite(count) ? count : 1 },
      destination: { type: isExternal ? "external" : "internal" },
      sensitivity: { level: isSensitive ? "sensitive" : "internal" },
      financialImpact: Number.isFinite(financialImpact) ? financialImpact : 0,
      parameters,
    });
  } catch (error) {
    throw new RiskServiceError(`Failed to map tool call to action: ${error.message}`);
  }
}

/**
 * Creates an instance of RiskService.
 *
 * @param {Object} [options={}]
 * @param {RiskEngine} [options.riskEngine]
 * @returns {Object}
 */
export function createRiskService(options = {}) {
  const riskEngine = options.riskEngine || new RiskEngine();

  return {
    /**
     * Evaluates risk for an existing canonical Action object.
     *
     * @param {Object} action
     * @returns {{
     *   score: number,
     *   level: string,
     *   band: Object,
     *   factors: Array<{ code: string, description: string, points: number }>,
     *   explanation: string,
     *   timestamp: string
     * }}
     */
    evaluateAction(action) {
      try {
        const validation = validateAction(action);
        if (!validation.valid) {
          throw new RiskServiceError(
            `Invalid action object: ${validation.errors.join("; ")}`,
            400,
            "INVALID_ACTION",
            { errors: validation.errors }
          );
        }

        const assessment = riskEngine.evaluate(action);
        const band = getRiskBand(assessment.score);
        const explanation = explainRiskAssessment(assessment);

        return {
          score: assessment.score,
          level: assessment.level,
          band,
          factors: assessment.factors,
          explanation,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        if (error instanceof RiskServiceError) throw error;
        throw new RiskServiceError(`Risk evaluation error: ${error.message}`, 500, "RISK_EVALUATION_FAILED");
      }
    },

    /**
     * Evaluates risk directly from tool invocation metadata and parameters.
     *
     * @param {Object} toolCall
     * @returns {Object}
     */
    evaluateToolCall(toolCall) {
      try {
        const action = mapToolCallToAction(toolCall);
        return this.evaluateAction(action);
      } catch (error) {
        if (error instanceof RiskServiceError) throw error;
        throw new RiskServiceError(`Tool call risk evaluation error: ${error.message}`, 400, "INVALID_TOOL_CALL");
      }
    },

    /**
     * Returns metadata for all risk bands.
     *
     * @returns {typeof RISK_BANDS}
     */
    getRiskBands() {
      return RISK_BANDS;
    },
  };
}

export default {
  RiskServiceError,
  RISK_BANDS,
  getRiskBand,
  explainRiskAssessment,
  mapToolCallToAction,
  createRiskService,
};
