import express from "express";
import { createAuditEvent } from "../audit/auditEvent.js";
import { validateAuditEvent } from "../audit/auditEventValidator.js";
import { DecisionEngine } from "../decision/decisionEngine.js";
import { createAction } from "../domain/action.js";
import { validateAction } from "../domain/actionValidator.js";
import { isValidUuid } from "../domain/agentValidator.js";
import { getSupabaseClient, supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { createActionRepository } from "../repositories/actionRepository.js";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { createDecisionRepository } from "../repositories/decisionRepository.js";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { ApiError } from "../utils/ApiError.js";

const defaultDecisionEngine = new DecisionEngine();

/**
 * Creates decision router with optional injected engines or repositories for testing.
 *
 * @param {Object | DecisionEngine} [options={}]
 * @returns {express.Router}
 */
export function createDecisionRoutes(options = {}) {
  const router = express.Router();

  let decisionEngine;
  let supabaseClient;
  let actionRepository;
  let decisionRepository;
  let auditEventRepository;
  let agentRepository;

  if (options instanceof DecisionEngine || (options && typeof options.evaluate === "function")) {
    decisionEngine = options;
    supabaseClient = defaultSupabaseClient;
  } else {
    decisionEngine = options.decisionEngine || defaultDecisionEngine;
    supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : (getSupabaseClient() || defaultSupabaseClient);
    actionRepository = options.actionRepository;
    decisionRepository = options.decisionRepository;
    auditEventRepository = options.auditEventRepository;
    agentRepository = options.agentRepository;
  }

  const resolvedActionRepo = actionRepository || (supabaseClient ? createActionRepository(supabaseClient) : null);
  const resolvedDecisionRepo = decisionRepository || (supabaseClient ? createDecisionRepository(supabaseClient) : null);
  const resolvedAuditEventRepo = auditEventRepository || (supabaseClient ? createAuditEventRepository(supabaseClient) : null);
  const resolvedAgentRepo = agentRepository || (supabaseClient ? createAgentRepository(supabaseClient) : null);

  router.post("/decisions", async (req, res) => {
    let decisionResult;
    let action;

    try {
      const body = req.body;

      // Ensure a non-empty object body was provided
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0) {
        throw new ApiError(
          400,
          "Request body must be a non-empty JSON object describing the action",
          "INVALID_ACTION",
        );
      }

      // Normalize into canonical action structure
      action = createAction(body);

      // Validate action using domain validator
      const validation = validateAction(action);
      if (!validation.valid) {
        throw new ApiError(400, validation.errors.join("; "), "INVALID_ACTION", validation.errors);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.errors?.length ? { details: err.errors } : {}),
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ACTION",
          message: err.message || "Invalid action payload",
        },
      });
    }

    // Validate agent context when agent repository is configured
    if (resolvedAgentRepo) {
      if (!isValidUuid(action.agentId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_AGENT_ID",
            message: "Invalid agent ID format. Expected standard UUID.",
          },
        });
      }

      let agent;
      try {
        agent = await resolvedAgentRepo.getAgentById(action.agentId);
      } catch (dbErr) {
        return res.status(500).json({
          success: false,
          error: {
            code: "AGENT_VERIFICATION_FAILED",
            message: "Failed to verify agent existence",
          },
        });
      }

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${action.agentId}" was not found`,
          },
        });
      }

      if (agent.status === "inactive") {
        return res.status(403).json({
          success: false,
          error: {
            code: "AGENT_INACTIVE",
            message: `Agent with ID "${action.agentId}" is inactive`,
          },
        });
      }
    }

    // Evaluate through DecisionEngine
    try {
      decisionResult = decisionEngine.evaluate(action);
    } catch (err) {
      // Security principle: FAIL CLOSED on unexpected engine exceptions
      return res.status(500).json({
        success: false,
        error: {
          code: "DECISION_EVALUATION_FAILED",
          message: "Unable to evaluate action",
        },
      });
    }

    // In-memory audit event creation and validation
    let auditEvent;
    try {
      auditEvent = createAuditEvent({
        action: decisionResult.action,
        risk: decisionResult.risk,
        policy: decisionResult.policy,
      });

      const auditValidation = validateAuditEvent(auditEvent);
      if (!auditValidation.valid) {
        return res.status(500).json({
          success: false,
          error: {
            code: "AUDIT_EVENT_CREATION_FAILED",
            message: "Unable to create audit event",
          },
        });
      }
    } catch (auditErr) {
      // Security principle: FAIL CLOSED on unexpected audit event errors
      return res.status(500).json({
        success: false,
        error: {
          code: "AUDIT_EVENT_CREATION_FAILED",
          message: "Unable to create audit event",
        },
      });
    }

    // 1. Persist Action
    if (resolvedActionRepo) {
      try {
        await resolvedActionRepo.createAction(decisionResult.action);
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: {
            code: "ACTION_PERSISTENCE_FAILED",
            message: "Failed to persist action",
          },
        });
      }
    }

    // 2. Persist Decision
    if (resolvedDecisionRepo) {
      try {
        await resolvedDecisionRepo.createDecision({
          actionId: decisionResult.action.id,
          risk: decisionResult.risk,
          policy: decisionResult.policy,
        });
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: {
            code: "DECISION_PERSISTENCE_FAILED",
            message: "Failed to persist decision",
          },
        });
      }
    }

    // 3. Persist Audit Event
    if (resolvedAuditEventRepo) {
      try {
        await resolvedAuditEventRepo.createAuditEvent(auditEvent);
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: {
            code: "AUDIT_PERSISTENCE_FAILED",
            message: "Failed to persist audit event",
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        action: decisionResult.action,
        risk: decisionResult.risk,
        policy: decisionResult.policy,
        audit: auditEvent,
      },
    });
  });

  return router;
}

export default createDecisionRoutes();
