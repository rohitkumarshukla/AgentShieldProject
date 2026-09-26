import app from "./app.js";
import { config } from "./config/env.js";

// Top-level unhandled rejection safety handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("[AgentShield] Unhandled Rejection at:", promise, "reason:", reason);
});

// Top-level uncaught exception safety handler
process.on("uncaughtException", (err) => {
  console.error("[AgentShield] Uncaught Exception:", err);
});

// Start the HTTP listener using centralized configuration
const server = app.listen(config.port, () => {
  console.log(`AgentShield backend is listening on http://localhost:${config.port}`);
});

export default server;
