import { createAction } from "../domain/action.js";
import { validateAction } from "../domain/actionValidator.js";
import { isValidUuid } from "../domain/agentValidator.js";
import { createSecurityInterceptor, SecurityInterceptor } from "../security/interceptor.js";
import { defaultToolRegistry } from "../tools/toolRegistry.js";

export class ActionServiceError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {string} [code='ACTION_SERVICE_ERROR']
   * @param {Object} [details={}]
   */
  constructor(message, statusCode = 500, code = "ACTION_SERVICE_ERROR", details = {}) {
    super(message);
    this.name = "ActionServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Creates an ActionService instance.
 *
 * Coordinates action creation, schema validation, and ensures that every tool call
 * strictly passes through the Security Interceptor (Authorization -> Risk -> Policy)
 * before any real-world execution takes place.
 *
 * @param {Object} [dependencies={}]
 * @param {Object} [dependencies.actionRepository]
 * @param {Object} [dependencies.agentRepository]
 * @param {Object} [dependencies.decisionRepository]
 * @param {Object} [dependencies.auditEventRepository]
 * @param {Object} [dependencies.approvalRepository]
 * @param {SecurityInterceptor} [dependencies.securityInterceptor]
 * @param {Object} [dependencies.toolRegistry]
 * @returns {Object}
 */
export function createActionService({
  actionRepository = null,
  agentRepository = null,
  decisionRepository = null,
  auditEventRepository = null,
  approvalRepository = null,
  securityInterceptor = null,
  toolRegistry = defaultToolRegistry,
} = {}) {
  const interceptor =
    securityInterceptor ||
    createSecurityInterceptor({
      agentRepository,
      actionRepository,
      decisionRepository,
      auditEventRepository,
      approvalRepository,
    });

  return {
    /**
     * Intercepts, evaluates, and conditionally executes a tool call requested by an agent.
     *
     * Strict Workflow:
     *   Tool Call Request -> Authorization -> Risk -> Policy -> Final Decision -> Conditional Execution
     *
     * @param {Object} request
     * @param {string} request.agentId - Requesting Agent UUID
     * @param {string} request.toolId - Tool identifier
     * @param {string} request.operation - Tool operation name
     * @param {Object} [request.parameters={}] - Operation arguments
     * @param {string} [request.environment='development'] - Environment target
     * @param {boolean} [request.dryRun=false] - Simulation mode
     * @param {Array<Object>} [request.customPolicies=[]] - Custom agent policy rules
     * @param {Object} [request.toolDef] - Optional tool & operation registry definitions
     * @returns {Promise<Object>} Complete governance and execution outcome
     */
    async createAndExecuteAction({
      agentId,
      toolId,
      operation,
      parameters = {},
      environment = "development",
      dryRun = false,
      customPolicies = [],
      toolDef = null,
    }) {
      if (!agentId || !isValidUuid(agentId)) {
        throw new ActionServiceError(
          "agentId is required and must be a valid UUID",
          400,
          "INVALID_AGENT_ID"
        );
      }

      if (!toolId || typeof toolId !== "string" || !operation || typeof operation !== "string") {
        throw new ActionServiceError(
          "toolId and operation are required strings",
          400,
          "INVALID_TOOL_ACTION"
        );
      }

      try {
        // 1. Intercept through complete security pipeline (Authorization -> Risk -> Policy)
        const interceptResult = await interceptor.interceptToolAction({
          agentId,
          toolId,
          operation,
          parameters,
          environment,
          customPolicies,
          toolDef,
        });

        const { action, risk, policy, audit } = interceptResult;

        // 2. Stage: Unauthorized or BLOCKED
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
            timestamp: new Date().toISOString(),
          };
        }

        // 3. Stage: APPROVAL_REQUIRED (Human-in-the-Loop)
        if (interceptResult.decision === "APPROVAL_REQUIRED" || policy?.requiresHumanApproval) {
          let approvalRecord = null;
          if (approvalRepository && action) {
            try {
              approvalRecord = await approvalRepository.createApproval({
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
            } catch (_apprErr) {}
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
            timestamp: new Date().toISOString(),
          };
        }

        // 4. Stage: SIMULATED_ALLOW (Dry-run)
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
            timestamp: new Date().toISOString(),
          };
        }

        // 5. Stage: Real Tool Execution (ALLOW)
        let toolResult;
        try {
          if (toolRegistry && typeof toolRegistry.executeOperation === "function") {
            toolResult = await toolRegistry.executeOperation(toolId, operation, parameters);
          } else if (toolRegistry && typeof toolRegistry.execute === "function") {
            toolResult = await toolRegistry.execute(toolId, operation, parameters);
          } else {
            toolResult = {
              success: true,
              message: "Tool executed successfully under policy allowance",
              executionTimeMs: 0,
            };
          }
        } catch (execErr) {
          toolResult = {
            success: false,
            error: execErr.message,
            executionTimeMs: 0,
          };
        }

        // Record execution outcome audit event
        if (auditEventRepository && audit) {
          try {
            await auditEventRepository.createAuditEvent({
              ...audit,
              status: toolResult.success ? "EXECUTED" : "FAILED",
              metadata: {
                ...audit.metadata,
                executionResult: toolResult,
              },
            });
          } catch (_auditErr) {}
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
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        if (err instanceof ActionServiceError) throw err;
        throw new ActionServiceError(
          `Action pipeline processing failure: ${err.message}`,
          500,
          "ACTION_PROCESSING_FAILED"
        );
      }
    },

    /**
     * Processes a canonical Action object through the Interceptor.
     *
     * @param {Object} actionInput
     * @param {Object} [options={}]
     * @param {boolean} [options.dryRun=false]
     * @param {Array<Object>} [options.customPolicies=[]]
     * @returns {Promise<Object>}
     */
    async processAction(actionInput, { dryRun = false, customPolicies = [] } = {}) {
      try {
        const action = createAction(actionInput);
        const validation = validateAction(action);
        if (!validation.valid) {
          throw new ActionServiceError(
            `Action validation failed: ${validation.errors.join("; ")}`,
            400,
            "INVALID_ACTION",
            { errors: validation.errors }
          );
        }

        const outcome = await interceptor.interceptAction({
          action,
          customPolicies,
        });

        return {
          ...outcome,
          dryRun,
        };
      } catch (err) {
        if (err instanceof ActionServiceError) throw err;
        throw new ActionServiceError(
          `Failed to process action: ${err.message}`,
          500,
          "ACTION_EVALUATION_FAILED"
        );
      }
    },

    /**
     * Retrieves an Action by UUID.
     *
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async getActionById(id) {
      if (!id || !isValidUuid(id)) {
        throw new ActionServiceError(
          "Invalid action ID format. Expected standard UUID.",
          400,
          "INVALID_ACTION_ID"
        );
      }

      if (!actionRepository) {
        throw new ActionServiceError(
          "Database persistence is not configured",
          503,
          "SUPABASE_NOT_CONFIGURED"
        );
      }

      try {
        const action = await actionRepository.getActionById(id.trim());
        if (!action) {
          throw new ActionServiceError(
            `Action with ID "${id}" was not found`,
            404,
            "ACTION_NOT_FOUND"
          );
        }

        return action;
      } catch (err) {
        if (err instanceof ActionServiceError) throw err;
        throw new ActionServiceError(
          `Failed to retrieve action: ${err.message}`,
          500,
          "ACTION_RETRIEVAL_FAILED"
        );
      }
    },

    /**
     * Lists actions associated with an Agent with pagination.
     *
     * @param {string} agentId
     * @param {Object} [pagination={}]
     * @param {number} [pagination.page=1]
     * @param {number} [pagination.limit=20]
     * @returns {Promise<{ actions: Array<Object>, pagination: Object }>}
     */
    async listActionsByAgent(agentId, { page = 1, limit = 20 } = {}) {
      if (!agentId || !isValidUuid(agentId)) {
        throw new ActionServiceError(
          "Invalid agent ID format. Expected standard UUID.",
          400,
          "INVALID_AGENT_ID"
        );
      }

      if (!actionRepository) {
        throw new ActionServiceError(
          "Database persistence is not configured",
          503,
          "SUPABASE_NOT_CONFIGURED"
        );
      }

      try {
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

        const result = await actionRepository.listActionsByAgentId(agentId.trim(), {
          page: safePage,
          limit: safeLimit,
        });

        const actions = Array.isArray(result) ? result : (result.items || []);
        const hasMore = Array.isArray(result) ? false : Boolean(result.hasMore);

        return {
          actions,
          pagination: {
            page: safePage,
            limit: safeLimit,
            hasMore,
          },
        };
      } catch (err) {
        if (err instanceof ActionServiceError) throw err;
        throw new ActionServiceError(
          `Failed to list actions for agent: ${err.message}`,
          500,
          "ACTION_LIST_FAILED"
        );
      }
    },
  };
}

export default {
  ActionServiceError,
  createActionService,
};
