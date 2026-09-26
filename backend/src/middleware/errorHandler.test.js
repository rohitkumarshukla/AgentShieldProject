import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { asyncHandler } from "./asyncHandler.js";
import { errorHandler } from "./errorHandler.js";

async function withServer(app, run) {
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("async route rejection reaches central handler and logs safe metadata only", async () => {
  const app = express();
  app.use(express.json());
  app.post("/failure/:id", asyncHandler(async (req) => {
    throw new Error(`database detail ${JSON.stringify(req.body)} ${req.get("authorization")} api_key_hash=secret-hash`);
  }));
  app.use(errorHandler);

  const originalError = console.error;
  const logs = [];
  console.error = (entry) => logs.push(entry);
  try {
    await withServer(app, async (url) => {
      const response = await fetch(`${url}/failure/secret-path-id`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer secret-credential" },
        body: JSON.stringify({ api_key: "secret-plaintext-key", api_key_hash: "secret-hash", private: "request-body" }),
      });
      const responseText = await response.text();
      assert.equal(response.status, 500);
      assert.match(responseText, /INTERNAL_SERVER_ERROR/);
      for (const secret of ["database detail", "secret-plaintext-key", "secret-hash", "secret-credential", "request-body", "secret-path-id", "stack"]) {
        assert.equal(responseText.includes(secret), false);
      }
      assert.equal(logs.length, 1);
      const log = JSON.parse(logs[0]);
      assert.equal(log.method, "POST");
      assert.equal(log.path, "/failure/:id");
      assert.equal(log.status, 500);
      assert.equal(log.code, "INTERNAL_SERVER_ERROR");
      assert.equal(log.errorName, "Error");
      for (const secret of ["database detail", "secret-plaintext-key", "secret-hash", "secret-credential", "request-body", "secret-path-id"]) {
        assert.equal(logs[0].includes(secret), false);
      }
    });
  } finally {
    console.error = originalError;
  }
});

test("central handler preserves malformed JSON 400 response", async () => {
  const app = express();
  app.use(express.json());
  app.use(errorHandler);
  await withServer(app, async (url) => {
    const response = await fetch(`${url}/input`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, error: { code: "INVALID_JSON", message: "Request body must contain valid JSON" } });
  });
});

test("oversized JSON body returns a safe 413 response", async () => {
  const app = express();
  app.use(express.json({ limit: "16b" }));
  app.use(errorHandler);
  await withServer(app, async (url) => {
    const response = await fetch(`${url}/input`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: "x".repeat(100) }) });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the allowed size" } });
  });
});
