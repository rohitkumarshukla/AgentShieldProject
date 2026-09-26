import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

import app from "../app.js";
import { createActionRoutes } from "./actionRoutes.js";
import { createActionRepository } from "../repositories/actionRepository.js";
import { createMockSupabaseClient } from "../repositories/mockSupabaseClient.js";
import { errorHandler } from "../middleware/errorHandler.js";

// Helper to run ephemeral HTTP server with isolated unconfigured app
async function withServer(fn) {
  return withCustomServer({ supabaseClient: null }, fn);
}


// Helper to run ephemeral HTTP server with a customized app (for dependency injection)
async function withCustomServer(options, fn) {
  const customApp = express();
  customApp.use(express.json());
  customApp.use("/api/v1", createActionRoutes(options));
  customApp.use(errorHandler);

  const server = http.createServer(customApp);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// -----------------------------------------------------------------------------
// GET /api/v1/actions/:id
// -----------------------------------------------------------------------------

test("GET /api/v1/actions/:id: successful retrieval returns HTTP 200 with action data", async () => {
  const mockAction = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    agent_id: "e6f47738-94df-4155-9b7e-9086fa2530cb",
    action_type: "delete",
    target: "users_table",
    description: "Purge inactive users",
    scope: { type: "bulk", count: 147 },
    destination: { type: "none", value: null },
    environment: "production",
    sensitivity: { level: "restricted" },
    financial_impact: 5000,
    metadata: { initiatedBy: "cron" },
    created_at: "2026-09-26T12:00:00.000Z",
  };

  const mockClient = createMockSupabaseClient({ data: mockAction });
  const repo = createActionRepository(mockClient);

  await withCustomServer({ actionRepository: repo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${mockAction.id}`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.action, mockAction);
  });
});

test("GET /api/v1/actions/:id: unknown action returns HTTP 404 with ACTION_NOT_FOUND", async () => {
  const fakeRepo = {
    async getActionById() {
      return null;
    },
  };

  const unknownUuid = "00000000-0000-0000-0000-000000000000";

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${unknownUuid}`);

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "ACTION_NOT_FOUND");
    assert.match(body.error.message, /not found/);
  });
});

test("GET /api/v1/actions/:id: invalid ID format returns HTTP 400 with INVALID_ACTION_ID", async () => {
  const fakeRepo = { async getActionById() {} };

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/not-a-valid-uuid`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_ACTION_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/actions/:id: repository failure returns HTTP 500 with ACTION_RETRIEVAL_FAILED", async () => {
  const fakeRepo = {
    async getActionById() {
      throw new Error("database timeout");
    },
  };

  const validUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${validUuid}`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "ACTION_RETRIEVAL_FAILED");
    assert.equal(body.error.message, "Failed to retrieve action record");
    assert.equal(body.error.raw, undefined);
  });
});

test("GET /api/v1/actions/:id: when Supabase not configured returns HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/3fa85f64-5717-4562-b3fc-2c963f66afa6`);

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});

// -----------------------------------------------------------------------------
// GET /api/v1/agents/:agentId/actions
// -----------------------------------------------------------------------------

test("GET /api/v1/agents/:agentId/actions: successful list returns HTTP 200 with actions array", async () => {
  const agentUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  const mockActions = [
    { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", agent_id: agentUuid, action_type: "read" },
    { id: "4fa85f64-5717-4562-b3fc-2c963f66afa7", agent_id: agentUuid, action_type: "write" },
  ];

  const fakeRepo = {
    async listActionsByAgentId(agentId) {
      if (agentId === agentUuid) return mockActions;
      return [];
    },
  };

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/actions`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.actions, mockActions);
  });
});

test("GET /api/v1/agents/:agentId/actions: returns default pagination page=1, limit=20", async () => {
  const agentUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  const mockActions = [
    { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", agent_id: agentUuid, action_type: "read" },
  ];

  let capturedOpts = null;
  const fakeRepo = {
    async listActionsByAgentId(agentId, opts) {
      capturedOpts = opts;
      return {
        items: mockActions,
        hasMore: false,
      };
    },
  };

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/actions`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.actions, mockActions);
    assert.deepEqual(body.data.pagination, { page: 1, limit: 20, hasMore: false });
    assert.deepEqual(capturedOpts, { page: 1, limit: 20 });
  });
});

test("GET /api/v1/agents/:agentId/actions: respects page & limit query params and hasMore", async () => {
  const agentUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  let capturedOpts = null;
  const fakeRepo = {
    async listActionsByAgentId(agentId, opts) {
      capturedOpts = opts;
      return {
        items: [{ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", agent_id: agentUuid }],
        hasMore: true,
      };
    },
  };

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/actions?page=2&limit=10`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.pagination, { page: 2, limit: 10, hasMore: true });
    assert.deepEqual(capturedOpts, { page: 2, limit: 10 });
  });
});

test("GET /api/v1/agents/:agentId/actions: rejects invalid pagination with HTTP 400 INVALID_PAGINATION", async () => {
  const agentUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  const fakeRepo = { async listActionsByAgentId() {} };

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/actions?limit=150`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_PAGINATION");
  });
});


test("GET /api/v1/agents/:agentId/actions: invalid agent ID returns HTTP 400 with INVALID_AGENT_ID", async () => {
  const fakeRepo = { async listActionsByAgentId() {} };

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/invalid-agent-id-format/actions`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AGENT_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/agents/:agentId/actions: repository failure returns HTTP 500 with ACTION_LIST_FAILED", async () => {
  const fakeRepo = {
    async listActionsByAgentId() {
      throw new Error("PostgreSQL connection error");
    },
  };

  const validAgentUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";

  await withCustomServer({ actionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${validAgentUuid}/actions`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "ACTION_LIST_FAILED");
    assert.equal(body.error.message, "Failed to list actions for agent");
  });
});

test("GET /api/v1/agents/:agentId/actions: when Supabase not configured returns HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/e6f47738-94df-4155-9b7e-9086fa2530cb/actions`);

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});
