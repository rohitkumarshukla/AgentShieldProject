import app from "./app.js";
import { env } from "./config/env.js";

// Server startup is separate from app.ts so the configured Express app can be
// imported independently by tests or other runtime entry points.
app.listen(env.PORT, () => {
  console.log(`AgentShield backend listening on port ${env.PORT}`);
});
