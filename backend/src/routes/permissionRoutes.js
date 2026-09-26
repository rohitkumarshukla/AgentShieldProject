import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logRequestError } from "../middleware/requestErrorLogger.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { createPermissionRepository } from "../repositories/permissionRepository.js";
import { createToolRepository } from "../repositories/toolRepository.js";
import { createPermissionService, PermissionServiceError } from "../services/permissionService.js";

export function createPermissionRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
  const agentRepository = options.agentRepository || (supabaseClient ? createAgentRepository(supabaseClient) : null);
  const toolRepository = options.toolRepository || (supabaseClient ? createToolRepository(supabaseClient) : null);
  const permissionRepository = options.permissionRepository || (supabaseClient ? createPermissionRepository(supabaseClient) : null);
  const service = options.permissionService || (agentRepository && toolRepository && permissionRepository
    ? createPermissionService({ agentRepository, toolRepository, permissionRepository })
    : null);
  const router = express.Router();

  const requireService = (req, res, next) => service
    ? next()
    : res.status(503).json({ success: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Database persistence is not configured" } });

  const handle = (handler, code) => asyncHandler(async (req, res) => {
    try {
      const result = await handler(req);
      return res.status(result.status || 200).json({ success: true, data: result.body });
    } catch (error) {
      if (error instanceof PermissionServiceError) {
        return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
      }
      logRequestError(req, error, { status: 500, code });
      return res.status(500).json({ success: false, error: { code, message: "Unable to complete permission request" } });
    }
  });

  router.post("/permissions", requireService, handle(async (req) => ({
    status: 201,
    body: { permission: await service.create(req.body) },
  }), "PERMISSION_CREATION_FAILED"));

  router.get("/permissions", requireService, handle(async (req) => ({
    body: { permissions: await service.listByAgentId(req.query.agentId) },
  }), "PERMISSION_LIST_FAILED"));

  router.delete("/permissions/:id", requireService, handle(async (req) => ({
    body: { permission: await service.delete(req.params.id) },
  }), "PERMISSION_DELETION_FAILED"));

  return router;
}

export default createPermissionRoutes();
