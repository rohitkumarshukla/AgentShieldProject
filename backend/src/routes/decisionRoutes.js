import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logRequestError } from "../middleware/requestErrorLogger.js";
import { createAuditEvent } from "../audit/auditEvent.js";
import { validateAuditEvent } from "../audit/auditEventValidator.js";
import { DecisionEngine } from "../decision/decisionEngine.js";
import { createAction } from "../domain/action.js";
import { validateAction } from "../domain/actionValidator.js";
import { createActionRepository } from "../repositories/actionRepository.js";
import { createDecisionRepository } from "../repositories/decisionRepository.js";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";

/**
 * Creates a decision router with configurable dependencies.
 *
 * Supports dependency injection for testing:
 * - decisionEngine: DecisionEngine instance
 * - supabaseClient: explicit Supabase client instance (or null to disable persistence)
 * - actionRepository: explicit ActionRepository instance (optional override)
 * - decisionRepository: explicit DecisionRepository instance (optional override)
 * - auditEventRepository: explicit AuditEventRepository instance (optional override)
 * - agentRepository: explicit AgentRepository instance (optional override)
 *
 * @param {Object} [options={}]
 * @param {DecisionEngine} [options.decisionEngine]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.actionRepository]
 * @param {Object} [options.decisionRepository]
 * @param {Object} [options.auditEventRepository]
 * @param {Object} [options.agentRepository]
 * @returns {express.Router}
 */
export function createDecisionRoutes(options = {}) {
  // Support legacy signature: createDecisionRoutes(decisionEngine)
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
    decisionEngine = options.decisionEngine || new DecisionEngine();
    supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
    actionRepository = options.actionRepository;
    decisionRepository = options.decisionRepository;
    auditEventRepository = options.auditEventRepository;
    agentRepository = options.agentRepository;
  }

  // Resolve repositories if Supabase is configured / provided
  const resolvedActionRepo = actionRepository || (supabaseClient ? createActionRepository(supabaseClient) : null);
  const resolvedDecisionRepo = decisionRepository || (supabaseClient ? createDecisionRepository(supabaseClient) : null);
  const resolvedAuditEventRepo = auditEventRepository || (supabaseClient ? createAuditEventRepository(supabaseClient) : null);
  const resolvedAgentRepo = agentRepository || (supabaseClient ? createAgentRepository(supabaseClient) : null);

  const router = express.Router();

  router.post("/decisions", asyncHandler(async (req, res) => {
    let decisionResult;
    let action;

    // 1. Normalize and validate action
    try {
      const body = req.body;

      // Ensure a non-empty object body was provided
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_ACTION",
            message: "Request body must be a non-empty JSON object describing the action",
          },
        });
      }

      // Normalize into canonical action structure
      action = createAction(body);

      // Validate action using domain validator
      const validation = validateAction(action);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_ACTION",
            message: validation.errors.join("; "),
          },
        });
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "DECISION_EVALUATION_FAILED",
          message: "Unable to evaluate action",
        },
      });
    }

    // 2. Validate agent context (when persistence / Supabase / agentRepository is configured)
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

    // 3. Evaluate through DecisionEngine
    try {
      decisionResult = decisionEngine.evaluate(action);
    } catch (err) {
      // Security principle: FAIL CLOSED on unexpected engine exceptions
      logRequestError(req, err, { code: "DECISION_EVALUATION_FAILED" });
      return res.status(500).json({
        success: false,
        error: {
          code: "DECISION_EVALUATION_FAILED",
          message: "Unable to evaluate action",
        },
      });
    }

    // 4. Persist Action (if persistence is configured)
    if (resolvedActionRepo) {
      try {
        await resolvedActionRepo.createAction(action);
      } catch (persistErr) {
        logRequestError(req, persistErr, { code: "ACTION_PERSISTENCE_FAILED" });
        return res.status(500).json({
          success: false,
          error: {
            code: "ACTION_PERSISTENCE_FAILED",
            message: "Failed to persist action",
          },
        });
      }
    }

    // 4. Persist Decision (if persistence is configured)
    if (resolvedDecisionRepo) {
      try {
        await resolvedDecisionRepo.createDecision(decisionResult);
      } catch (persistErr) {
        logRequestError(req, persistErr, { code: "DECISION_PERSISTENCE_FAILED" });
        return res.status(500).json({
          success: false,
          error: {
            code: "DECISION_PERSISTENCE_FAILED",
            message: "Failed to persist decision",
          },
        });
      }
    }

    // 5. In-memory audit event creation and validation
    let auditEvent;
    try {
      auditEvent = createAuditEvent({
        action: decisionResult.action,
        risk: decisionResult.risk,
        policy: decisionResult.policy,
      });

      const auditValidation = validateAuditEvent(auditEvent);
      if (!auditValidation.valid) {
        logRequestError(req, new Error("Audit event validation failed"), { code: "AUDIT_EVENT_CREATION_FAILED" });
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
        logRequestError(req, auditErr, { code: "AUDIT_EVENT_CREATION_FAILED" });
        return res.status(500).json({
          success: false,
          error: {
            code: "AUDIT_EVENT_CREATION_FAILED",
            message: "Unable to create audit event",
          },
        });
      }

    // 6. Persist Audit Event (if persistence is configured)
    if (resolvedAuditEventRepo) {
      try {
        await resolvedAuditEventRepo.createAuditEvent(auditEvent);
      } catch (auditPersistErr) {
        logRequestError(req, auditPersistErr, { code: "AUDIT_PERSISTENCE_FAILED" });
        return res.status(500).json({
          success: false,
          error: {
            code: "AUDIT_PERSISTENCE_FAILED",
            message: "Failed to persist audit event",
          },
        });
      }
    }

    // 7. Return successful governance response
    return res.status(200).json({
      success: true,
      data: {
        action: decisionResult.action,
        risk: decisionResult.risk,
        policy: decisionResult.policy,
        audit: auditEvent,
      },
    });
  }));

  return router;
}

export default createDecisionRoutes();
