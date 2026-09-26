import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import decisionRoutes from "./routes/decisionRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import actionRoutes from "./routes/actionRoutes.js";
import decisionHistoryRoutes from "./routes/decisionHistoryRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";

// The Express application instance is separated from server listening logic
// so it can be imported cleanly by integration tests without opening network ports.
const app = express();

// Standard middleware to parse incoming JSON payloads into req.body
app.use(express.json());

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