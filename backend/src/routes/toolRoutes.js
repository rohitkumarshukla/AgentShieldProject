import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logRequestError } from "../middleware/requestErrorLogger.js";
import { isValidUuid } from "../domain/agentValidator.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { createToolRepository } from "../repositories/toolRepository.js";
import { createToolService, ToolServiceError } from "../services/toolService.js";

export function createToolRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
  const repository = options.toolRepository || (supabaseClient ? createToolRepository(supabaseClient) : null);
  const service = options.toolService || (repository ? createToolService(repository) : null);
  const router = express.Router();

  const requireService = (req, res, next) => service
    ? next()
    : res.status(503).json({ success: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Database persistence is not configured" } });

  const handle = (handler, code) => asyncHandler(async (req, res) => {
    try {
      const result = await handler(req);
      return res.status(result.status || 200).json({ success: true, data: result.body });
    } catch (error) {
      if (error instanceof ToolServiceError) {
        return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
      }
      logRequestError(req, error, { status: 500, code });
      return res.status(500).json({ success: false, error: { code, message: "Unable to complete tool registry request" } });
    }
  });

  router.post("/tools", requireService, handle(async (req) => ({ status: 201, body: { tool: await service.create(req.body) } }), "TOOL_CREATION_FAILED"));
  router.get("/tools", requireService, handle(async () => ({ body: { tools: await service.list() } }), "TOOL_LIST_FAILED"));
  router.get("/tools/:id", requireService, handle(async (req) => {
    if (!isValidUuid(req.params.id)) throw new ToolServiceError("Tool ID must be a valid UUID", 400, "INVALID_TOOL_ID");
    return { body: { tool: await service.get(req.params.id.trim()) } };
  }, "TOOL_RETRIEVAL_FAILED"));

  return router;
}

export default createToolRoutes();
