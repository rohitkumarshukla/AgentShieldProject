import { defaultToolRegistry } from "./toolRegistry.js";
import { DecisionEngine } from "../decision/decisionEngine.js";
import { createAction } from "../domain/action.js";
import { createAuditEvent } from "../audit/auditEvent.js";
import { authorizeAgentToolAction } from "../services/authorization.service.js";

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

    // Step 1 & 2: Tool Registry Lookup
    const opInfo = this.toolRegistry.getOperation(toolId, operation);
    if (!opInfo) {
      throw new Error(`Tool or operation '${toolId}.${operation}' not found in registry`);
    }

    const { tool, operation: opDef } = opInfo;

    // Step 3: Agent Lookup & Permission Authorization
    let agent = null;
    if (this.agentRepository) {
      try {
        agent = await this.agentRepository.getAgentById(agentId);
      } catch (err) {
        throw new Error(`Agent verification lookup failed: ${err.message}`);
      }

      if (!agent) {
        throw new Error(`Agent with ID '${agentId}' does not exist`);
      }

      // Authorize agent status, environment, allowed tools, blocked operations, and financial caps
      const authResult = authorizeAgentToolAction(agent, {
        toolId,
        operation,
        parameters,
        environment,
      });

      if (!authResult.authorized) {
        return {
          status: "BLOCKED",
          executed: false,
          decision: "BLOCK",
          reason: authResult.reason || "Agent unauthorized to perform tool operation",
          policyCode: authResult.code || "AGENT_UNAUTHORIZED",
          pipeline: {
            agentVerified: true,
            toolFound: true,
            permissionGranted: false,
          },
        };
      }
    }

    // Step 4: Map tool call to canonical Action object
    const count = typeof parameters.count === "number"
      ? parameters.count
      : (typeof parameters.recipientCount === "number"
        ? parameters.recipientCount
        : (Array.isArray(parameters.customerIds)
          ? parameters.customerIds.length
          : (Array.isArray(parameters.recipients) ? parameters.recipients.length : 1)));

    const financialImpact = typeof parameters.amount === "number"
      ? parameters.amount
      : (typeof opDef.financialImpact === "function"
        ? opDef.financialImpact(parameters)
        : (typeof opDef.financialImpact === "number" ? opDef.financialImpact : 0));

    const destination = opDef.destination || (tool.category === "communication" ? { type: "external" } : { type: "internal" });
    const sensitivity = opDef.sensitivity || (tool.category === "data" ? { level: "sensitive" } : { level: "public" });

    const actionPayload = {
      agentId,
      actionType: opDef.actionType || "execute",
      target: `${toolId}.${operation}`,
      description: opDef.description || `Execute ${tool.name} ${operation}`,
      environment: environment || agent?.environment || "development",
      scope: {
        count,
        target: `${toolId}.${operation}`,
        parameters,
      },
      destination,
      sensitivity,
      financialImpact,
      metadata: {
        toolId,
        operation,
        reversibility: opDef.reversibility || "partially_reversible",
      },
    };

    const action = createAction(actionPayload);

    // Step 5: Evaluate through Risk & Policy Decision Engine
    const decisionResult = this.decisionEngine.evaluate(action);
    const { risk, policy } = decisionResult;

    // Step 6: Create Audit Event
    const auditEvent = createAuditEvent({
      action,
      risk,
      policy,
    });

    // Step 7: Ordered Persistence (Action -> Decision -> Approval/Audit)
    if (this.actionRepository) {
      try {
        await this.actionRepository.createAction(action);
      } catch (err) {
        console.warn("[AgentShield] Failed to persist action:", err.message);
      }
    }

    if (this.decisionRepository) {
      try {
        await this.decisionRepository.createDecision({
          actionId: action.id,
          risk,
          policy,
        });
      } catch (err) {
        console.warn("[AgentShield] Failed to persist decision:", err.message);
      }
    }

    // Step 8: Outcome Handling
    if (policy.decision === "BLOCK") {
      if (this.auditEventRepository) {
        try {
          await this.auditEventRepository.createAuditEvent({
            ...auditEvent,
            status: "BLOCKED",
          });
        } catch {}
      }

      return {
        status: "BLOCKED",
        executed: false,
        decision: "BLOCK",
        action,
        risk,
        policy,
        audit: auditEvent,
        message: `Action BLOCKED: ${policy.reason}`,
        suppressedImpact: {
          preventedOperation: `${toolId}.${operation}`,
          scopeCount: count,
        },
      };
    }

    if (policy.decision === "APPROVAL_REQUIRED" || policy.requiresHumanApproval) {
      let approvalRecord = null;
      if (this.approvalRepository) {
        try {
          approvalRecord = await this.approvalRepository.createApproval({
            actionId: action.id,
            status: "pending",
            reason: policy.reason,
            metadata: {
              toolId,
              operation,
              parameters,
              riskScore: risk.score,
              policyCode: policy.policyCode,
            },
          });
        } catch {}
      }

      if (this.auditEventRepository) {
        try {
          await this.auditEventRepository.createAuditEvent({
            ...auditEvent,
            status: "AWAITING_APPROVAL",
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
        audit: auditEvent,
        approval: approvalRecord,
        message: `Action requires human authorization before execution: ${policy.reason}`,
      };
    }

    // Step 9: ALLOW: Check dryRun vs real execution
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

    if (this.auditEventRepository) {
      try {
        await this.auditEventRepository.createAuditEvent({
          ...auditEvent,
          status: toolResult.success ? "EXECUTED" : "FAILED",
          metadata: {
            ...auditEvent.metadata,
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
      audit: auditEvent,
      execution: toolResult,
      result: toolResult,
    };
  }
}

export default {
  GovernedToolExecutor,
};
