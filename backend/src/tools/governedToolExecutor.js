import { defaultToolRegistry } from "./toolRegistry.js";
import { DecisionEngine } from "../decision/decisionEngine.js";
import { SecurityInterceptor } from "../security/interceptor.js";

const defaultDecisionEngine = new DecisionEngine();

/**
 * Governed Tool Executor.
 * Intercepts, evaluates, and conditionally executes tool calls through AgentShield security controls.
 *
 * Strict Architecture Workflow:
 *   Agent -> Tool -> Permission -> Risk -> Policy -> Decision -> (Execution if ALLOW)
 */
export class GovernedToolExecutor {
  constructor({
    toolRegistry = defaultToolRegistry,
    decisionEngine = defaultDecisionEngine,
    agentRepository = null,
    actionRepository = null,
    decisionRepository = null,
    auditEventRepository = null,
    approvalRepository = null,
  } = {}) {
    this.toolRegistry = toolRegistry;
    this.decisionEngine = decisionEngine;
    this.agentRepository = agentRepository;
    this.actionRepository = actionRepository;
    this.decisionRepository = decisionRepository;
    this.auditEventRepository = auditEventRepository;
    this.approvalRepository = approvalRepository;

    this.interceptor = new SecurityInterceptor({
      agentRepository,
      actionRepository,
      decisionRepository,
      auditEventRepository,
      approvalRepository,
    });
  }

  /**
   * Evaluates and executes a tool call under the strict AgentShield governance pipeline.
   *
   * Pipeline Steps:
   * 1. Agent Verification & Status Check
   * 2. Tool Lookup & Schema Verification
   * 3. Permission & Boundary Authorization
   * 4. Action Translation & Risk Evaluation
   * 5. Policy Rule Determination
   * 6. Decision & Audit Logging
   * 7. Conditional Execution (only if ALLOW and not dryRun)
   *
   * @param {Object} request
   * @param {string} request.agentId - UUID of the requesting AI Agent
   * @param {string} request.toolId - Target tool ID (e.g. 'customer_crm')
   * @param {string} request.operation - Operation name (e.g. 'deleteCustomers')
   * @param {Object} [request.parameters={}] - Input parameters for tool operation
   * @param {string} [request.environment="development"] - Target execution environment
   * @param {boolean} [request.dryRun=false] - If true, evaluates governance pipeline without executing downstream mock tool
   * @returns {Promise<Object>} Structured governance outcome
   */
  async invokeGovernedTool({
    agentId,
    toolId,
    operation,
    parameters = {},
    environment = "development",
    dryRun = false,
  }) {
    if (!agentId || !toolId || !operation) {
      throw new Error("agentId, toolId, and operation are required to invoke a tool");
    }

    // Step 1: Tool Registry Lookup
    const opInfo = this.toolRegistry.getOperation(toolId, operation);
    if (!opInfo) {
      throw new Error(`Tool or operation '${toolId}.${operation}' not found in registry`);
    }

    const { tool, operation: opDef } = opInfo;

    // Step 2, 3, 4, 5: Security Pipeline (Authorization -> Risk -> Policy)
    const interceptResult = await this.interceptor.interceptToolAction({
      agentId,
      toolId,
      operation,
      parameters,
      environment,
      toolDef: opInfo,
    });

    const { action, risk, policy, audit } = interceptResult;

    // Step 6: Outcome Handling

    // A. Unauthorized or Blocked
    if (!interceptResult.authorized || interceptResult.decision === "BLOCK") {
      return {
        status: "BLOCKED",
        executed: false,
        decision: "BLOCK",
        action,
        risk,
        policy,
        audit,
        reason: policy?.reason || interceptResult.reason,
        policyCode: policy?.policyCode || interceptResult.policyCode,
        message: `Action BLOCKED: ${policy?.reason || interceptResult.reason}`,
        pipeline: interceptResult.pipeline,
        suppressedImpact: {
          preventedOperation: `${toolId}.${operation}`,
          scopeCount: action?.scope?.count || 1,
        },
      };
    }

    // B. Approval Required
    if (interceptResult.decision === "APPROVAL_REQUIRED" || policy?.requiresHumanApproval) {
      let approvalRecord = null;
      if (this.approvalRepository && action) {
        try {
          approvalRecord = await this.approvalRepository.createApproval({
            actionId: action.id,
            status: "pending",
            reason: policy.reason,
            metadata: {
              toolId,
              operation,
              parameters,
              riskScore: risk?.score,
              policyCode: policy?.policyCode,
            },
          });
        } catch {}
      }

      return {
        status: "APPROVAL_REQUIRED",
        executed: false,
        decision: "APPROVAL_REQUIRED",
        action,
        risk,
        policy,
        audit,
        approval: approvalRecord,
        message: `Action requires human authorization before execution: ${policy.reason}`,
      };
    }

    // C. Dry-Run Simulated Allow
    if (dryRun) {
      return {
        status: "SIMULATED_ALLOW",
        executed: false,
        dryRun: true,
        decision: "ALLOW",
        action,
        risk,
        policy,
        message: "Governance policy allows action. (Dry-run mode: tool execution omitted)",
      };
    }

    // D. Real Tool Execution
    let toolResult;
    try {
      toolResult = await this.toolRegistry.executeOperation(toolId, operation, parameters);
    } catch (execErr) {
      toolResult = {
        success: false,
        error: execErr.message,
        executionTimeMs: 0,
      };
    }

    if (this.auditEventRepository && audit) {
      try {
        await this.auditEventRepository.createAuditEvent({
          ...audit,
          status: toolResult.success ? "EXECUTED" : "FAILED",
          metadata: {
            ...audit.metadata,
            executionResult: toolResult,
          },
        });
      } catch {}
    }

    return {
      status: "EXECUTED",
      executed: true,
      decision: "ALLOW",
      action,
      risk,
      policy,
      audit,
      execution: toolResult,
      result: toolResult,
    };
  }
}

export default {
  GovernedToolExecutor,
};
