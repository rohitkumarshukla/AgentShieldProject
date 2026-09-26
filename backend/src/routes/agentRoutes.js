import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logRequestError } from "../middleware/requestErrorLogger.js";
import { isValidUuid, normalizeCreateAgentInput, validateCreateAgentInput } from "../domain/agentValidator.js";
import { validatePaginationMiddleware } from "../middleware/pagination.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { AgentServiceError, createAgentService } from "../services/agentService.js";
import { createAgentRepository } from "../repositories/agentRepository.js";

export function createAgentRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined
    ? options.supabaseClient
    : defaultSupabaseClient;
  const repository = options.agentRepository || (supabaseClient ? createAgentRepository(supabaseClient) : null);
  const service = options.agentService || (repository ? createAgentService(repository, options.cryptoOptions) : null);
  const router = express.Router();

  function requireService(req, res, next) {
    if (!service) {
      return res.status(503).json({
        success: false,
        error: {
          code: "SUPABASE_NOT_CONFIGURED",
          message: "Database persistence is not configured",
        },
      });
    }
    return next();
  }

  const handle = (handler, failureCode = "AGENT_REGISTRY_FAILED", failureMessage = "Unable to complete agent registry request") =>
    asyncHandler(async (req, res) => {
      try {
        const data = await handler(req);
        return res.status(data.status || 200).json({ success: true, data: data.body });
      } catch (error) {
        if (error instanceof AgentServiceError) {
          return res.status(error.statusCode).json({
            success: false,
            error: { code: error.code, message: error.message },
          });
        }
        logRequestError(req, error, { status: 500, code: failureCode });
        return res.status(500).json({
          success: false,
          error: { code: failureCode, message: failureMessage },
        });
      }
    });

  router.post("/agents", requireService, handle(async (req) => {
    const validation = validateCreateAgentInput(req.body);
    if (!validation.valid) {
      const errors = validation.errors.map((message) =>
        message.startsWith("Invalid status ")
          ? "Invalid status. Allowed values: active, inactive"
          : message.startsWith("Invalid environment ")
            ? "Invalid environment. Allowed values: development, staging, production"
            : message,
      );
      throw new AgentServiceError(errors.join("; "), 400, "INVALID_AGENT");
    }

    const input = normalizeCreateAgentInput(req.body);
    const extendedInput = Object.hasOwn(req.body, "status")
      || Object.hasOwn(req.body, "environment")
      || Object.hasOwn(req.body, "metadata");

    // Keep AgentService's public input contract to name/description. The
    // request-scoped repository adapter adds the schema-supported fields only
    // after AgentService has generated and hashed the API key.
    const createService = repository && !options.agentService
      ? createAgentService({
        createAgent: (agent) => repository.createAgent({
          ...agent,
          status: input.status,
          environment: input.environment,
          metadata: input.metadata,
        }),
      }, options.cryptoOptions)
      : service;

    if (extendedInput && (!repository || options.agentService)) {
      throw new AgentServiceError("Agent creation supports name and description only", 400, "INVALID_AGENT");
    }

    const created = await createService.create({ name: input.name, description: input.description });
    return { status: 201, body: created };
  }, "AGENT_CREATION_FAILED", "Failed to persist agent record"));

  router.get("/agents", requireService, validatePaginationMiddleware, handle(async (req) => {
    let repositoryResult;
    const listService = repository && !options.agentService
      ? createAgentService({
        listAgents: async () => {
          repositoryResult = await repository.listAgents(req.pagination);
          return Array.isArray(repositoryResult) ? repositoryResult : repositoryResult?.items || [];
        },
      }, options.cryptoOptions)
      : service;
    const agents = await listService.list();
    const hasMore = Array.isArray(repositoryResult) ? false : Boolean(repositoryResult?.hasMore);
    return {
      body: {
        agents,
        pagination: { ...req.pagination, hasMore },
      },
    };
  }, "AGENT_LIST_FAILED", "Failed to retrieve agent records"));

  router.get("/agents/:id", requireService, handle(async (req) => {
    const id = req.params.id;
    if (!isValidUuid(id)) {
      throw new AgentServiceError("Invalid agent ID format. Expected standard UUID.", 400, "INVALID_AGENT_ID");
    }
    return { body: { agent: await service.get(id.trim()) } };
  }, "AGENT_RETRIEVAL_FAILED", "Failed to retrieve agent record"));

  router.patch("/agents/:id", requireService, handle(async (req) => ({
    body: { agent: await service.update(req.params.id, req.body) },
  }), "AGENT_UPDATE_FAILED", "Failed to update agent record"));

  router.post("/agents/:id/rotate-key", requireService, handle(async (req) => ({
    body: await service.rotateKey(req.params.id),
  }), "AGENT_KEY_ROTATION_FAILED", "Failed to rotate agent API key"));

  return router;
}

export default createAgentRoutes();
