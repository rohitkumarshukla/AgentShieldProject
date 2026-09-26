import express from "express";
import { createAuditEvent } from "../audit/auditEvent.js";
import { validateAuditEvent } from "../audit/auditEventValidator.js";
import { DecisionEngine } from "../decision/decisionEngine.js";
import { createAction } from "../domain/action.js";
import { validateAction } from "../domain/actionValidator.js";

const router = express.Router();
const defaultDecisionEngine = new DecisionEngine();

/**
 * Creates decision router with optional injected DecisionEngine for testing.
 *
 * @param {DecisionEngine} [decisionEngine]
 * @returns {express.Router}
 */
export function createDecisionRoutes(decisionEngine = defaultDecisionEngine) {
  router.post("/decisions", (req, res, next) => {
    let decisionResult;

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
      const action = createAction(body);

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

      // Evaluate through DecisionEngine
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

    try {
      // Construct and validate the audit event using the evaluated decision output
      const auditEvent = createAuditEvent({
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

      return res.status(200).json({
        success: true,
        data: {
          action: decisionResult.action,
          risk: decisionResult.risk,
          policy: decisionResult.policy,
          audit: auditEvent,
        },
      });
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
  });

  return router;
}

export default createDecisionRoutes();
