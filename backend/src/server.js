import app from "./app.js";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`AgentShield backend listening on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});

export default server;
