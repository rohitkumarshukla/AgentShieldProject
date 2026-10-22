/**
 * Action API routes for AgentShield.
 */

import { Router } from "express";
import { handleExecuteAction } from "../controllers/actionController.js";

const router = Router();

// POST /api/v1/actions/execute
router.post("/execute", handleExecuteAction);

export default router;
