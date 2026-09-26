import { defaultToolRegistry } from "./toolRegistry.js";
import { DecisionEngine } from "../decision/decisionEngine.js";
import { createAction } from "../domain/action.js";
import { createAuditEvent } from "../audit/auditEvent.js";

const defaultDecisionEngine = new DecisionEngine();

/**
 * Governed Tool Executor.
 * Intercepts, evaluates, and conditionally executes tool calls through AgentShield security controls.
 */
export class GovernedToolExecutor {
  constructor({
    toolRegistry = defaultToolRegistry,
    decisionEngine = defaultDecisionEngine,
    agentRepository = null,
    actionRepository = null,
    decisionRepository = null,
    auditEventRepository = null,
  } = {}) {
    this.toolRegistry = toolRegistry;
    this.decisionEngine = decisionEngine;
    this.agentRepository = agentRepository;
    this.actionRepository = actionRepository;
    this.decisionRepository = decisionRepository;
    this.auditEventRepository = auditEventRepository;
  }

  /**
   * Evaluates and executes a tool call under AgentShield governance.
   *
   * @param {Object} request
   * @param {string} request.agentId - UUID of the requesting AI Agent
   * @param {string} request.toolId - Target tool ID (e.g. 'customer_crm')
   * @param {string} request.operation - Operation name (e.g. 'delete_customers')
   * @param {Object} [request.parameters={}] - Input parameters for tool operation
   * @param {string} [request.environment="development"] - Target execution environment
   * @returns {Promise<Object>} Execution result or block/approval notice
   */
  async invokeGovernedTool({
    agentId,
    toolId,
    operation,
    parameters = {},
    environment = "development",
  }) {
    if (!agentId || !toolId || !operation) {
      throw new Error("agentId, toolId, and operation are required to invoke a tool");
    }

    const opInfo = this.toolRegistry.getOperation(toolId, operation);
    if (!opInfo) {
      throw new Error(`Tool or operation '${toolId}.${operation}' not found in registry`);
    }

    const { tool, operation: opDef } = opInfo;

    // 1. Agent Verification & Permissions Check
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

      if (agent.status !== "active") {
        throw new Error(`Agent '${agent.name || agentId}' is inactive and prohibited from executing tools`);
      }

      // Check agent permissions if configured
      const permissions = agent.metadata?.permissions;
      if (permissions) {
        // Allowed tools check
        if (Array.isArray(permissions.allowedTools) && !permissions.allowedTools.includes("*") && !permissions.allowedTools.includes(toolId)) {
          return {
            status: "BLOCKED",
            executed: false,
            decision: "BLOCK",
            reason: `Agent is not authorized to access tool '${tool.name || toolId}' under agent permissions`,
            policyCode: "agent_permission_tool_prohibited",
          };
        }

        // Blocked operations check
        if (Array.isArray(permissions.blockedOperations) && permissions.blockedOperations.includes(operation)) {
          return {
            status: "BLOCKED",
            executed: false,
            decision: "BLOCK",
            reason: `Operation '${operation}' is explicitly prohibited by agent policy`,
            policyCode: "agent_permission_operation_blocked",
          };
        }
      }
    }

    // 2. Map tool call to canonical Action object
    const count = typeof parameters.count === "number"
      ? parameters.count
      : (Array.isArray(parameters.customerIds)
        ? parameters.customerIds.length
        : (Array.isArray(parameters.recipients) ? parameters.recipients.length : 1));

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
      environment: environment || agent?.environment || "production",
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

    // 3. Evaluate through Risk and Policy Decision Engine
    const decisionResult = this.decisionEngine.evaluate(action);
    const { risk, policy } = decisionResult;

    // 4. Create Audit Event
    const auditEvent = createAuditEvent({
      action,
      risk,
      policy,
    });

    // 5. Persist to database if repositories are configured
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

    // 6. Handle Decision Outcomes
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
        message: `Action requires human authorization before execution: ${policy.reason}`,
      };
    }

    // 7. ALLOW: Execute Tool Operation safely
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
    };
  }
}

export const defaultGovernedToolExecutor = new GovernedToolExecutor();
export default defaultGovernedToolExecutor;
