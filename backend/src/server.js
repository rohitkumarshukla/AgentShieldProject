import app from "./app.js";
import { config } from "./config/env.js";

// Start the HTTP listener using centralized configuration
app.listen(config.port, () => {
  console.log(`AgentShield backend is listening on http://localhost:${config.port}`);
});
