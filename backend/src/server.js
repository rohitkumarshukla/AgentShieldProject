import app from "./app.js";

// PORT is resolved from environment variables, falling back to 3000 for standard local development.
const PORT = process.env.PORT || 3000;

// Start the HTTP listener
app.listen(PORT, () => {
  console.log(`AgentShield backend is listening on http://localhost:${PORT}`);
});
