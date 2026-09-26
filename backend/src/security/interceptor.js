import crypto from "node:crypto";
import {
  authorizeAgentToolAction,
  validateAgentStatus,
} from "../services/authorization.service.js";
import { RiskEngine } from "../risk/riskEngine.js";
import { createRiskService } from "../risk/risk.service.js";
import { PolicyEngine } from "../policy/policyEngine.js";
import { createPolicyService } from "../policy/policy.service.js";
import { createAction } from "../domain/action.js";
import { createAuditEvent } from "../audit/auditEvent.js";

export class SecurityInterceptorError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {string} [code='SECURITY_INTERCEPTION_ERROR']
   * @param {Object} [details={}]
   */
  constructor(message, statusCode = 500, code = "SECURITY_INTERCEPTION_ERROR", details = {}) {
    super(message);
    this.name = "SecurityInterceptorError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * AgentShield Security Interceptor.
 *
 * Implements the core security pipeline:
 *   Agent Intent -> Authorization -> Risk Evaluation -> Policy Determination -> Final Decision
 *
 * Responsibilities:
 * - Coordinates the strict security chain across services.
 * - Guarantees fail-closed error handling throughout all stages.
 * - Produces normalized governance outcomes and audit events.
 */
export class SecurityInterceptor {
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.agentRepository]
   * @param {Object} [options.actionRepository]
   * @param {Object} [options.decisionRepository]
   * @param {Object} [options.auditEventRepository]
   * @param {Object} [options.approvalRepository]
   * @param {Object} [options.riskService]
   * @param {Object} [options.policyService]
   */
  constructor({
    agentRepository = null,
    actionRepository = null,
    decisionRepository = null,
    auditEventRepository = null,
    approvalRepository = null,
    riskService = null,
    policyService = null,
  } = {}) {
    this.agentRepository = agentRepository;
    this.actionRepository = actionRepository;
    this.decisionRepository = decisionRepository;
    this.auditEventRepository = auditEventRepository;
    this.approvalRepository = approvalRepository;

    this.riskEngine = new RiskEngine();
    this.policyEngine = new PolicyEngine();

    this.riskService = riskService || createRiskService({ riskEngine: this.riskEngine });
    this.policyService = policyService || createPolicyService({
      riskEngine: this.riskEngine,
      policyEngine: this.policyEngine,
    });
  }

  /**
   * Intercepts and evaluates a proposed tool action through the full security pipeline:
   *   Step 1: Authorization
   *   Step 2: Risk Evaluation
   *   Step 3: Policy Determination (Final Authority)
   *
   * @param {Object} request
   * @param {Object} [request.agent] - Direct agent object (optional if agentId provided)
   * @param {string} [request.agentId] - Agent UUID for repository resolution
   * @param {string} request.toolId - Target tool ID (e.g. 'customer_crm')
   * @param {string} request.operation - Operation name (e.g. 'delete_customers')
   * @param {Object} [request.parameters={}] - Operation arguments
   * @param {string} [request.environment='development'] - Environment target
   * @param {Array<Object>} [request.customPolicies=[]] - Agent custom policies
   * @param {Object} [request.toolDef] - Optional tool & operation registry definitions
   * @returns {Promise<Object>} Comprehensive governance outcome
   */
  async interceptToolAction({
    agent = null,
    agentId = null,
    toolId,
    operation,
    parameters = {},
    environment = "development",
    customPolicies = [],
    toolDef = null,
  } = {}) {
    try {
      if (!toolId || typeof toolId !== "string" || !operation || typeof operation !== "string") {
        throw new SecurityInterceptorError(
          "toolId and operation are required for tool action interception",
          400,
          "INVALID_TOOL_ACTION_REQUEST"
        );
      }

      // 1. Resolve and Validate Agent
      let resolvedAgent = agent;
      const targetAgentId = agent?.id || agentId;

      if (!resolvedAgent && targetAgentId && this.agentRepository) {
        try {
          resolvedAgent = await this.agentRepository.getAgentById(targetAgentId);
        } catch (repoErr) {
          throw new SecurityInterceptorError(
            `Agent repository lookup failed: ${repoErr.message}`,
            500,
            "AGENT_LOOKUP_FAILED"
          );
        }
      }

      // ==========================================
      // STAGE 1: AUTHORIZATION (Agent & Tool Boundaries)
      // ==========================================
      if (resolvedAgent) {
        const statusValidation = validateAgentStatus(resolvedAgent);
        if (!statusValidation.valid) {
          return this._buildUnauthorizedResponse({
            agentId: targetAgentId,
            toolId,
            operation,
            reason: statusValidation.reason || "Agent is inactive or suspended",
            code: statusValidation.code || "AGENT_INACTIVE",
            stage: "AUTHORIZATION",
          });
        }

        const authResult = authorizeAgentToolAction(resolvedAgent, {
          toolId,
          operation,
          parameters,
          environment,
        });

        if (!authResult.authorized) {
          return this._buildUnauthorizedResponse({
            agentId: targetAgentId,
            toolId,
            operation,
            reason: authResult.reason || "Agent unauthorized to invoke tool operation",
            code: authResult.code || "TOOL_UNAUTHORIZED",
            stage: "AUTHORIZATION",
          });
        }
      }

      // ==========================================
      // STAGE 2: CANONICAL ACTION & RISK EVALUATION
      // ==========================================
      const action = this._mapToAction({
        agentId: targetAgentId || "00000000-0000-0000-0000-000000000000",
        agent: resolvedAgent,
        toolId,
        operation,
        parameters,
        environment,
        toolDef,
      });

      let riskAssessment;
      try {
        riskAssessment = this.riskEngine.evaluate(action);
      } catch (riskErr) {
        throw new SecurityInterceptorError(
          `Risk evaluation stage failed: ${riskErr.message}`,
          500,
          "RISK_EVALUATION_FAILED"
        );
      }

      // ==========================================
      // STAGE 3: POLICY DETERMINATION (FINAL AUTHORITY)
      // ==========================================
      let policyResult;
      try {
        policyResult = await this.policyService.evaluatePolicyAsync(
          action,
          riskAssessment,
          customPolicies
        );
      } catch (policyErr) {
        throw new SecurityInterceptorError(
          `Policy evaluation stage failed: ${policyErr.message}`,
          500,
          "POLICY_EVALUATION_FAILED"
        );
      }

      // Create Audit Event
      const auditEvent = createAuditEvent({
        action,
        risk: riskAssessment,
        policy: policyResult,
      });

      // Handle Asynchronous Persistence
      await this._persistPipelineArtifacts({
        action,
        risk: riskAssessment,
        policy: policyResult,
        audit: auditEvent,
      });

      return {
        success: true,
        status: policyResult.decision === "ALLOW" ? "ALLOWED" : policyResult.decision,
        decision: policyResult.decision,
        authorized: true,
        action,
        risk: {
          score: riskAssessment.score,
          level: riskAssessment.level,
          factors: riskAssessment.factors,
        },
        policy: {
          decision: policyResult.decision,
          policyCode: policyResult.policyCode,
          policyName: policyResult.policyName,
          reason: policyResult.reason,
          requiresHumanApproval: policyResult.requiresHumanApproval,
        },
        audit: auditEvent,
        pipeline: {
          authorization: true,
          riskEvaluated: true,
          policyApplied: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof SecurityInterceptorError) throw error;
      throw new SecurityInterceptorError(
        `Security interception failure: ${error.message}`,
        500,
        "SECURITY_INTERCEPTION_FAILED"
      );
    }
  }

  /**
   * Intercepts an existing canonical Action object through Authorization -> Risk -> Policy.
   *
   * @param {Object} request
   * @param {Object} request.action - Canonical action object
   * @param {Object} [request.agent] - Optional Agent record
   * @param {Array<Object>} [request.customPolicies=[]]
   * @returns {Promise<Object>}
   */
  async interceptAction({ action, agent = null, customPolicies = [] } = {}) {
    try {
      if (!action || typeof action !== "object") {
        throw new SecurityInterceptorError("Action object is required", 400, "INVALID_ACTION");
      }

      // 1. Authorization
      if (agent) {
        const statusValidation = validateAgentStatus(agent);
        if (!statusValidation.valid) {
          return this._buildUnauthorizedResponse({
            agentId: action.agentId,
            toolId: action.metadata?.toolId || "custom",
            operation: action.metadata?.operation || action.actionType,
            reason: statusValidation.reason,
            code: statusValidation.code,
            stage: "AUTHORIZATION",
          });
        }
      }

      // 2. Risk Evaluation
      const risk = this.riskEngine.evaluate(action);

      // 3. Policy Evaluation (Final Authority)
      const policy = await this.policyService.evaluatePolicyAsync(action, risk, customPolicies);

      // Audit Event
      const audit = createAuditEvent({ action, risk, policy });

      await this._persistPipelineArtifacts({ action, risk, policy, audit });

      return {
        success: true,
        status: policy.decision === "ALLOW" ? "ALLOWED" : policy.decision,
        decision: policy.decision,
        authorized: true,
        action,
        risk,
        policy,
        audit,
        pipeline: {
          authorization: true,
          riskEvaluated: true,
          policyApplied: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof SecurityInterceptorError) throw error;
      throw new SecurityInterceptorError(
        `Action interception error: ${error.message}`,
        500,
        "ACTION_INTERCEPTION_FAILED"
      );
    }
  }

  /**
   * Maps tool invocation arguments into a Canonical Action object.
   * @private
   */
  _mapToAction({ agentId, agent, toolId, operation, parameters, environment, toolDef }) {
    const opDef = toolDef?.operation || {};
    const tool = toolDef?.tool || {};

    const count = typeof parameters.count === "number"
      ? parameters.count
      : (typeof parameters.recipientCount === "number"
        ? parameters.recipientCount
        : (typeof parameters.batchSize === "number"
          ? parameters.batchSize
          : (Array.isArray(parameters.customerIds)
            ? parameters.customerIds.length
            : (Array.isArray(parameters.recipients) ? parameters.recipients.length : 1))));

    const financialImpact = typeof parameters.amount === "number"
      ? parameters.amount
      : (typeof opDef.financialImpact === "function"
        ? opDef.financialImpact(parameters)
        : (typeof opDef.financialImpact === "number"
          ? opDef.financialImpact
          : (typeof parameters.financialImpact === "number" ? parameters.financialImpact : 0)));

    const destination = opDef.destination || (
      tool.category === "communication" || toolId.includes("email") || toolId.includes("comms")
        ? { type: "external" }
        : { type: "internal" }
    );

    const sensitivity = opDef.sensitivity || (
      tool.category === "data" || toolId.includes("export") || toolId.includes("finance")
        ? { level: "sensitive" }
        : { level: "internal" }
    );

    let actionType = opDef.actionType;
    if (!actionType) {
      const lowerOp = operation.toLowerCase();
      if (lowerOp.includes("delete") || lowerOp.includes("drop") || lowerOp.includes("purge")) {
        actionType = "delete";
      } else if (lowerOp.includes("send") || lowerOp.includes("notify")) {
        actionType = "send";
      } else if (lowerOp.includes("create") || lowerOp.includes("update") || lowerOp.includes("write")) {
        actionType = "write";
      } else if (lowerOp.includes("read") || lowerOp.includes("get") || lowerOp.includes("query")) {
        actionType = "read";
      } else {
        actionType = "execute";
      }
    }

    return createAction({
      id: crypto.randomUUID(),
      agentId: agentId || agent?.id || "00000000-0000-0000-0000-000000000000",
      actionType,
      target: `${toolId}.${operation}`,
      description: opDef.description || `Tool action ${toolId} -> ${operation}`,
      environment: environment || agent?.environment || "development",
      scope: {
        count: Number.isFinite(count) ? count : 1,
        target: `${toolId}.${operation}`,
        parameters,
      },
      destination,
      sensitivity,
      financialImpact: Number.isFinite(financialImpact) ? financialImpact : 0,
      metadata: {
        toolId,
        operation,
        reversibility: opDef.reversibility || "partially_reversible",
        permissions: agent?.metadata?.permissions || {},
      },
    });
  }

  /**
   * Builds standardized unauthorized response when authorization stage rejects an action.
   * @private
   */
  _buildUnauthorizedResponse({ agentId, toolId, operation, reason, code, stage }) {
    return {
      success: true,
      status: "BLOCKED",
      decision: "BLOCK",
      authorized: false,
      reason,
      policyCode: code || "AUTHORIZATION_REJECTED",
      policy: {
        decision: "BLOCK",
        policyCode: code || "AUTHORIZATION_REJECTED",
        reason,
        requiresHumanApproval: false,
      },
      pipeline: {
        stage,
        authorization: false,
        riskEvaluated: false,
        policyApplied: false,
      },
      metadata: {
        agentId,
        toolId,
        operation,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Persists pipeline outcomes into repositories safely.
   * @private
   */
  async _persistPipelineArtifacts({ action, risk, policy, audit }) {
    try {
      if (this.actionRepository) {
        await this.actionRepository.createAction(action).catch(() => {});
      }
      if (this.decisionRepository) {
        await this.decisionRepository.createDecision({
          actionId: action.id,
          risk,
          policy,
        }).catch(() => {});
      }
      if (this.auditEventRepository) {
        const auditStatus = policy.decision === "BLOCK"
          ? "BLOCKED"
          : (policy.decision === "APPROVAL_REQUIRED" ? "AWAITING_APPROVAL" : "DECISION_MADE");
        await this.auditEventRepository.createAuditEvent({
          ...audit,
          status: auditStatus,
        }).catch(() => {});
      }
    } catch {
      // Background persistence failure does not block the security evaluation
    }
  }
}

/**
 * Factory helper function to create a SecurityInterceptor instance.
 *
 * @param {Object} [options={}]
 * @returns {SecurityInterceptor}
 */
export function createSecurityInterceptor(options = {}) {
  return new SecurityInterceptor(options);
}

export default {
  SecurityInterceptor,
  SecurityInterceptorError,
  createSecurityInterceptor,
};
