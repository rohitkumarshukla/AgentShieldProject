import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import decisionRoutes from "./routes/decisionRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import actionRoutes from "./routes/actionRoutes.js";
import decisionHistoryRoutes from "./routes/decisionHistoryRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import toolRoutes from "./routes/toolRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import approvalRoutes from "./routes/approvalRoutes.js";

// The Express application instance is separated from server listening logic
// so it can be imported cleanly by integration tests without opening network ports.
const app = express();

// Standard middleware to parse incoming JSON payloads into req.body
app.use(express.json());

// Enable Cross-Origin Resource Sharing (CORS) for frontend clients
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, x-agent-api-key"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Root endpoint for browser visits and API welcome info
app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    service: "AgentShield Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      decisions: "/api/v1/decisions",
      agents: "/api/v1/agents",
      actions: "/api/v1/actions",
      auditEvents: "/api/v1/audit-events",
      tools: "/api/v1/tools",
      approvals: "/api/v1/approvals",
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint provides a lightweight liveness check for monitoring
// and local verification without side effects.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AgentShield Backend",
    timestamp: new Date().toISOString(),
  });
});

// Mount AgentShield v1 API routes
app.use("/api/v1", decisionRoutes);
app.use("/api/v1", agentRoutes);
app.use("/api/v1", actionRoutes);
app.use("/api/v1", decisionHistoryRoutes);
app.use("/api/v1", auditRoutes);
app.use("/api/v1", toolRoutes);
app.use("/api/v1", permissionRoutes);
app.use("/api/v1", approvalRoutes);

// Catch-all 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// Error handling middleware for malformed JSON and unexpected server errors
app.use(errorHandler);

export default app;
