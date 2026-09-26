import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import { createAgentRoutes } from "./agentRoutes.js";
import { createMockSupabaseClient } from "../repositories/mockSupabaseClient.js";
import app from "../app.js";

async function withServer(client, run) {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", createAgentRoutes({ supabaseClient: client, cryptoOptions: { generateKey: () => "secure-test-key", hashKey: (key) => createHash("sha256").update(key).digest("hex"), now: () => "2026-09-26T00:00:00.000Z" } }));
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

describe("Agent registry routes", () => {
  it("creates an agent and persists only its hashed API key", async () => {
    const client = createMockSupabaseClient({ data: { id: "agent-1", name: "worker", status: "active", api_key_hash: "hash:secure-test-key" } });
    await withServer(client, async (url) => {
      const response = await fetch(`${url}/api/v1/agents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "worker" }) });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.data.api_key, "secure-test-key");
      assert.equal(body.data.agent.api_key_hash, undefined);
      assert.equal(client.calls.inserts[0].api_key_hash, createHash("sha256").update("secure-test-key").digest("hex"));
      assert.equal(JSON.stringify(client.calls.inserts[0]).includes("secure-test-key"), false);
    });
  });

  it("rejects invalid create input", async () => {
    await withServer(createMockSupabaseClient(), async (url) => {
      for (const input of [{}, { name: "  " }, { name: "x".repeat(101) }, { name: "x", description: 3 }, { name: "x", status: "active" }]) {
        const response = await fetch(`${url}/api/v1/agents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
        assert.equal(response.status, 400);
      }
    });
  });

  it("lists agents without key material", async () => {
    await withServer(createMockSupabaseClient({ data: [{ id: "a", name: "worker", api_key_hash: "secret-hash" }] }), async (url) => {
      const response = await fetch(`${url}/api/v1/agents`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.agents[0].api_key_hash, undefined);
      assert.equal(JSON.stringify(body).includes("secret-hash"), false);
    });
  });

  it("gets an agent and returns 404 for a missing agent", async () => {
    await withServer(createMockSupabaseClient({ data: { id: "a", name: "worker", api_key_hash: "h" } }), async (url) => {
      const response = await fetch(`${url}/api/v1/agents/a`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.api_key_hash, undefined);
    });
    await withServer(createMockSupabaseClient({ error: { code: "PGRST116", message: "no rows" } }), async (url) => {
      const response = await fetch(`${url}/api/v1/agents/missing`);
      assert.equal(response.status, 404);
    });
  });

  it("updates allowed fields and rejects empty, invalid, and protected updates", async () => {
    const client = createMockSupabaseClient({ data: { id: "a", name: "new", status: "inactive" } });
    await withServer(client, async (url) => {
      const request = (body) => fetch(`${url}/api/v1/agents/a`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      assert.equal((await request({ name: "new", status: "inactive" })).status, 200);
      assert.deepEqual(client.calls.updates[0], { name: "new", status: "inactive", updated_at: "2026-09-26T00:00:00.000Z" });
      for (const input of [{}, { status: "paused" }, { name: " " }, { id: "x" }, { api_key_hash: "x" }, { created_at: "x" }, { arbitrary: true }]) assert.equal((await request(input)).status, 400);
    });
  });

  it("rotates the key once and replaces the stored hash", async () => {
    const client = createMockSupabaseClient({ data: { id: "a", name: "worker", api_key_hash: "old-hash" } });
    await withServer(client, async (url) => {
      const response = await fetch(`${url}/api/v1/agents/a/rotate-key`, { method: "POST" });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.api_key, "secure-test-key");
      assert.equal(body.data.agent.api_key_hash, undefined);
      assert.deepEqual(client.calls.updates[0], { api_key_hash: createHash("sha256").update("secure-test-key").digest("hex") });
    });
  });

  it("does not leak database errors", async () => {
    await withServer(createMockSupabaseClient({ error: { code: "XX000", message: "internal database detail" } }), async (url) => {
      const failure = await fetch(`${url}/api/v1/agents`);
      const body = await failure.json();
      assert.equal(failure.status, 500);
      assert.equal(JSON.stringify(body).includes("internal database detail"), false);
    });
  });

  it("returns 404 for a missing update target and leaves the app decisions route functional", async () => {
    await withServer(createMockSupabaseClient({ error: { code: "PGRST116", message: "no rows" } }), async (url) => {
      const response = await fetch(`${url}/api/v1/agents/missing`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Updated" }) });
      assert.equal(response.status, 404);
    });

    const server = app.listen(0);
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/decisions`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "demo-agent", actionType: "read", target: "knowledge-base", description: "Read internal articles", scope: { type: "single", count: 1 }, destination: { type: "internal" }, environment: "development", sensitivity: { level: "internal" }, financialImpact: 0 }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).success, true);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
});
