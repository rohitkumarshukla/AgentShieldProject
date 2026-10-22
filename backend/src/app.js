import express from "express";
import actionRoutes from "./routes/actionRoutes.js";

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Liveness probe endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AgentShield Backend",
  });
});

// Governance action execution API
app.use("/api/v1/actions", actionRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

export default app;
