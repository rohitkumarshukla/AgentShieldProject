/**
 * Action Controller for AgentShield.
 *
 * Handles HTTP requests for the governance execution pipeline.
 */

import { ApiResponse } from "../utils/ApiResponse.js";
import { executeAction } from "../services/action.service.js";

/**
 * Handles POST /api/v1/actions/execute.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function handleExecuteAction(req, res, next) {
  try {
    const rawAction = req.body;

    // Check for malformed or missing body
    if (!rawAction || typeof rawAction !== "object" || Array.isArray(rawAction)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action payload: request body must be a JSON object.",
      });
    }

    // Coordinate normalization and governance interception
    const result = executeAction(rawAction);

    // Send successful governance result using ApiResponse
    const response = new ApiResponse(
      200,
      result,
      "Action processed through governance pipeline."
    );

    return res.status(200).json(response);
  } catch (error) {
    // If validation fails (thrown by createAction, validateAction, or riskEngine count validator)
    if (
      error.message &&
      (error.message.includes("Action validation failed") ||
        error.message.includes("Invalid count parameter") ||
        error.message.includes("must be a"))
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Pass unexpected errors to the Express error-handling pipeline
    next(error);
  }
}
