import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

test("GET /health returns 200 and expected status object", async () => {
  // Start the server on port 0 to bind to an available ephemeral port
  const server = app.listen(0);

  try {
    const address = server.address();
    const port = address.port;
    const url = `http://localhost:${port}/health`;

    // Perform real HTTP request using Node's built-in fetch
    const response = await fetch(url);

    // 1. Verify status code is 200
    assert.equal(response.status, 200);

    // 2. Verify response content type is JSON
    const contentType = response.headers.get("content-type");
    assert.match(contentType, /application\/json/);

    const body = await response.json();

    // 3. Verify the JSON exactly matches the expected response
    assert.deepEqual(body, {
      status: "ok",
      service: "AgentShield Backend",
    });
  } finally {
    // Ensure the test server is cleanly closed even if assertions fail
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
