import express from "express";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { AgentServiceError, createAgentService } from "../services/agentService.js";

export function createAgentRoutes(options = {}) {
  const repository = options.agentRepository || (options.supabaseClient ? createAgentRepository(options.supabaseClient) : defaultSupabaseClient ? createAgentRepository(defaultSupabaseClient) : null);
  const service = options.agentService || (repository ? createAgentService(repository, options.cryptoOptions) : null);
  const router = express.Router();

  const handle = (handler) => async (req, res) => {
    try {
      if (!service) throw new Error("Agent persistence is unavailable");
      const result = await handler(req);
      return res.status(result.status || 200).json({ success: true, data: result.data });
    } catch (error) {
      const known = error instanceof AgentServiceError;
      const status = known ? error.statusCode : 500;
      return res.status(status).json({ success: false, error: {
        code: known ? error.code : "AGENT_REGISTRY_FAILED",
        message: known ? error.message : "Unable to complete agent registry request",
      } });
    }
  };

  router.post("/agents", handle(async (req) => ({ status: 201, data: await service.create(req.body) })));
  router.get("/agents", handle(async () => ({ data: { agents: await service.list() } })));
  router.get("/agents/:id", handle(async (req) => ({ data: await service.get(req.params.id) })));
  router.patch("/agents/:id", handle(async (req) => ({ data: await service.update(req.params.id, req.body) })));
  router.post("/agents/:id/rotate-key", handle(async (req) => ({ data: await service.rotateKey(req.params.id) })));

  return router;
}

export default createAgentRoutes();
