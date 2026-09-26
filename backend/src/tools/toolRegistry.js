import { MOCK_TOOLS } from "./mockTools.js";

/**
 * Tool Registry for AgentShield.
 * Manages available tools, operations, schemas, and execution handlers.
 */
export class ToolRegistry {
  constructor(initialTools = MOCK_TOOLS) {
    this.tools = new Map();
    for (const tool of initialTools) {
      this.registerTool(tool);
    }
  }

  /**
   * Registers a new tool with its supported operations.
   *
   * @param {Object} tool
   * @returns {Object}
   */
  registerTool(tool) {
    if (!tool || typeof tool !== "object" || !tool.id || !tool.name) {
      throw new Error("Tool registration requires a valid tool object with 'id' and 'name'");
    }

    const normalizedTool = {
      id: String(tool.id).trim().toLowerCase(),
      name: String(tool.name).trim(),
      description: tool.description || "",
      category: tool.category || "general",
      version: tool.version || "1.0.0",
      status: tool.status || "online",
      operations: Array.isArray(tool.operations) ? [...tool.operations] : [],
      metadata: tool.metadata || {},
    };

    this.tools.set(normalizedTool.id, normalizedTool);
    return normalizedTool;
  }

  /**
   * Unregisters a tool by ID.
   *
   * @param {string} toolId
   * @returns {boolean}
   */
  unregisterTool(toolId) {
    if (!toolId) return false;
    return this.tools.delete(String(toolId).trim().toLowerCase());
  }

  /**
   * Retrieves a tool by ID.
   *
   * @param {string} toolId
   * @returns {Object | null}
   */
  getTool(toolId) {
    if (!toolId || typeof toolId !== "string") return null;
    return this.tools.get(toolId.trim().toLowerCase()) || null;
  }

  /**
   * Finds a specific tool operation by tool ID and operation name.
   *
   * @param {string} toolId
   * @param {string} operationName
   * @returns {{ tool: Object, operation: Object } | null}
   */
  getOperation(toolId, operationName) {
    const tool = this.getTool(toolId);
    if (!tool) return null;

    const opName = String(operationName).trim().toLowerCase();
    const operation = tool.operations.find(
      (op) => op.name.toLowerCase() === opName
    );

    if (!operation) return null;
    return { tool, operation };
  }

  /**
   * Lists all registered tools (without internal execution handlers).
   *
   * @returns {Array<Object>}
   */
  listTools() {
    const list = [];
    for (const tool of this.tools.values()) {
      list.push({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        version: tool.version,
        status: tool.status,
        operations: tool.operations.map((op) => ({
          name: op.name,
          description: op.description,
          actionType: op.actionType,
          reversibility: op.reversibility,
          defaultRisk: op.defaultRisk,
          parameters: op.parameters || {},
        })),
      });
    }
    return list;
  }

  /**
   * Executes a tool operation directly with provided parameters.
   * Safely wraps execution in try/catch and performance timing.
   *
   * @param {string} toolId
   * @param {string} operationName
   * @param {Object} [parameters={}]
   * @returns {Promise<{ success: boolean, toolId: string, operation: string, result?: any, executionTimeMs: number, error?: string }>}
   */
  async executeOperation(toolId, operationName, parameters = {}) {
    const opInfo = this.getOperation(toolId, operationName);
    if (!opInfo) {
      throw new Error(`Tool operation '${toolId}.${operationName}' is not registered`);
    }

    const { operation } = opInfo;
    if (typeof operation.handler !== "function") {
      throw new Error(`Operation '${operationName}' on tool '${toolId}' has no executable handler`);
    }

    const startTime = Date.now();

    try {
      const result = await operation.handler(parameters);
      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        toolId,
        operation: operationName,
        result,
        executionTimeMs,
        executedAt: new Date().toISOString(),
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        toolId,
        operation: operationName,
        error: err.message || "Execution error",
        executionTimeMs,
        executedAt: new Date().toISOString(),
      };
    }
  }
}

export const defaultToolRegistry = new ToolRegistry();
export default defaultToolRegistry;
