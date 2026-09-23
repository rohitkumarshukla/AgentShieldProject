import cors from "cors";
import express from "express";

// The backend is isolated from the frontend so API capabilities can evolve
// independently without coupling service concerns to the Vite application.
const app = express();

app.use(cors());
app.use(express.json());

// Health checks provide a lightweight target for local development, deployment,
// and service monitoring before the broader AgentShield API is introduced.
app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "agentshield-backend",
  });
});

// Add future AgentShield API routes here as each capability is implemented.
export default app;
