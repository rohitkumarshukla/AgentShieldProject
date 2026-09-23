import "dotenv/config";

import app from "./app.js";

// Server startup is separate from app.ts so the configured Express app can be
// imported independently by tests or other runtime entry points.
// Environment configuration will expand here as backend services are added.
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`AgentShield backend listening on port ${port}`);
});
