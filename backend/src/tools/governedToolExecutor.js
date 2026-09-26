import { defaultToolRegistry } from "./toolRegistry.js";
import { DecisionEngine } from "../decision/decisionEngine.js";
import { createActionService } from "../services/action.service.js";

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
    actionService = null,
  } = {}) {
    this.toolRegistry = toolRegistry;
    this.decisionEngine = decisionEngine;
    this.agentRepository = agentRepository;
    this.actionRepository = actionRepository;
    this.decisionRepository = decisionRepository;
    this.auditEventRepository = auditEventRepository;
    this.approvalRepository = approvalRepository;

    this.actionService =
      actionService ||
      createActionService({
        actionRepository,
        agentRepository,
        decisionRepository,
        auditEventRepository,
        approvalRepository,
        toolRegistry,
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

    // 1. Tool Registry Lookup
    const opInfo = this.toolRegistry.getOperation(toolId, operation);
    if (!opInfo) {
      throw new Error(`Tool or operation '${toolId}.${operation}' not found in registry`);
    }

    // 2. Execute through ActionService pipeline
    return this.actionService.createAndExecuteAction({
      agentId,
      toolId,
      operation,
      parameters,
      environment,
      dryRun,
      toolDef: opInfo,
    });
  }
}

export default {
  GovernedToolExecutor,
};
