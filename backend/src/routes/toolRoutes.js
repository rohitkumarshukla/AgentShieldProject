import express from "express";
import { defaultToolRegistry } from "../tools/toolRegistry.js";
import { GovernedToolExecutor } from "../tools/governedToolExecutor.js";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { createActionRepository } from "../repositories/actionRepository.js";
import { createDecisionRepository } from "../repositories/decisionRepository.js";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { createApprovalRepository } from "../repositories/approvalRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";

/**
 * Factory creating Tool router with configurable dependencies.
 *
 * @param {Object} [options={}]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.toolRegistry]
 * @param {Object} [options.governedExecutor]
 * @returns {express.Router}
 */
export function createToolRoutes(options = {}) {
  const supabaseClient =
    options.supabaseClient !== undefined
      ? options.supabaseClient
      : defaultSupabaseClient;

  const toolRegistry = options.toolRegistry || defaultToolRegistry;

  const agentRepository = options.agentRepository || (supabaseClient ? createAgentRepository(supabaseClient) : null);
  const actionRepository = options.actionRepository || (supabaseClient ? createActionRepository(supabaseClient) : null);
  const decisionRepository = options.decisionRepository || (supabaseClient ? createDecisionRepository(supabaseClient) : null);
  const auditEventRepository = options.auditEventRepository || (supabaseClient ? createAuditEventRepository(supabaseClient) : null);
  const approvalRepository = options.approvalRepository || (supabaseClient ? createApprovalRepository(supabaseClient) : null);

  const governedExecutor =
    options.governedExecutor ||
    new GovernedToolExecutor({
      toolRegistry,
      agentRepository,
      actionRepository,
      decisionRepository,
      auditEventRepository,
      approvalRepository,
    });

  const router = express.Router();

  // ---------------------------------------------------------------------------
  // 1. GET /api/v1/tools — List all available tools in registry
  // ---------------------------------------------------------------------------
  router.get("/tools", (req, res) => {
    try {
      const tools = toolRegistry.listTools();
      return res.status(200).json({
        success: true,
        data: {
          tools,
          count: tools.length,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "TOOL_LIST_FAILED",
          message: "Failed to retrieve registered tools",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/tools/:id — Get details of a specific tool
  // ---------------------------------------------------------------------------
  router.get("/tools/:id", (req, res) => {
    try {
      const { id } = req.params;
      const tool = toolRegistry.getTool(id);

      if (!tool) {
        return res.status(404).json({
          success: false,
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool with ID '${id}' is not registered`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          tool,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "TOOL_RETRIEVAL_FAILED",
          message: "Failed to retrieve tool record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. POST /api/v1/tools/execute — Execute a tool under AgentShield Governance
  // ---------------------------------------------------------------------------
  router.post("/tools/execute", async (req, res) => {
    try {
      const body = req.body;

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must be a JSON object with agentId, toolId, and operation",
          },
        });
      }

      const { agentId, toolId, operation, parameters = {}, environment } = body;

      if (!agentId || !isValidUuid(agentId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_AGENT_ID",
            message: "agentId is required and must be a valid UUID",
          },
        });
      }

      if (!toolId || typeof toolId !== "string") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_TOOL_ID",
            message: "toolId is required (e.g. 'customer_crm')",
          },
        });
      }

      if (!operation || typeof operation !== "string") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_OPERATION",
            message: "operation is required (e.g. 'deleteCustomers')",
          },
        });
      }

      const outcome = await governedExecutor.invokeGovernedTool({
        agentId,
        toolId,
        operation,
        parameters,
        environment,
        dryRun: false,
      });

      return res.status(200).json({
        success: true,
        data: outcome,
      });
    } catch (err) {
      const isClientError =
        err.message?.includes("does not exist") ||
        err.message?.includes("inactive") ||
        err.message?.includes("not found");

      return res.status(isClientError ? 400 : 500).json({
        success: false,
        error: {
          code: isClientError ? "GOVERNED_EXECUTION_REJECTED" : "TOOL_EXECUTION_FAILED",
          message: err.message || "Failed to execute governed tool",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. POST /api/v1/tools/:id/test — Dry-run simulation through governance pipeline
  // (NO un-governed bypasses: strictly passes through Permission -> Risk -> Policy)
  // ---------------------------------------------------------------------------
  router.post("/tools/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      const { operation, parameters = {}, agentId, environment } = req.body || {};

      if (!operation || typeof operation !== "string") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_OPERATION",
            message: "operation is required to test tool",
          },
        });
      }

      const mockAgentId = agentId && isValidUuid(agentId) ? agentId : "00000000-0000-0000-0000-000000000000";

      const outcome = await governedExecutor.invokeGovernedTool({
        agentId: mockAgentId,
        toolId: id,
        operation,
        parameters,
        environment: environment || "development",
        dryRun: true,
      });

      return res.status(200).json({
        success: true,
        data: outcome,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: "TOOL_TEST_FAILED",
          message: err.message || "Failed to test tool operation",
        },
      });
    }
  });

  return router;
}

export const toolRoutes = createToolRoutes();
export default toolRoutes;
