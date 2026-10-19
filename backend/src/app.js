import express from "express";

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

export default app;
