import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

import app from "../app.js";
import { createAgentRoutes } from "./agentRoutes.js";
import { createAgentRepository } from "../repositories/agentRepository.js";
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
  customApp.use("/api/v1", createAgentRoutes(options));
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
// POST /api/v1/agents
// -----------------------------------------------------------------------------

test("POST /api/v1/agents: valid agent creation returns HTTP 201 with generated UUID and data", async () => {
  const mockAgent = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    name: "Sales Follow-up Agent",
    description: "Handles CRM lead follow-ups",
    status: "active",
    environment: "production",
    metadata: { team: "sales" },
    created_at: "2026-09-26T16:00:00.000Z",
    updated_at: "2026-09-26T16:00:00.000Z",
  };

  const mockClient = createMockSupabaseClient({ data: mockAgent });
  const repo = createAgentRepository(mockClient);

  await withCustomServer({ agentRepository: repo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sales Follow-up Agent",
        description: "Handles CRM lead follow-ups",
        status: "active",
        environment: "production",
        metadata: { team: "sales" },
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.agent, mockAgent);
    assert.equal(body.data.agent.id, "3fa85f64-5717-4562-b3fc-2c963f66afa6");
  });
});

test("POST /api/v1/agents: applies defaults when only name is provided", async () => {
  let capturedInput;
  const fakeRepo = {
    async createAgent(input) {
      capturedInput = input;
      return {
        id: "e6f47738-94df-4155-9b7e-9086fa2530cb",
        ...input,
        created_at: "2026-09-26T16:00:00.000Z",
        updated_at: "2026-09-26T16:00:00.000Z",
      };
    },
  };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Minimal Agent",
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(capturedInput.name, "Minimal Agent");
    assert.equal(capturedInput.status, "active");
    assert.equal(capturedInput.environment, "development");
    assert.equal(capturedInput.description, null);
    assert.deepEqual(capturedInput.metadata, {});
  });
});

test("POST /api/v1/agents: missing name returns HTTP 400 with INVALID_AGENT", async () => {
  const fakeRepo = { async createAgent() {} };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Agent without name",
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AGENT");
    assert.match(body.error.message, /Agent name is required/);
  });
});

test("POST /api/v1/agents: empty name string returns HTTP 400 with INVALID_AGENT", async () => {
  const fakeRepo = { async createAgent() {} };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "   ",
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AGENT");
    assert.match(body.error.message, /Agent name must be a non-empty string/);
  });
});

test("POST /api/v1/agents: invalid status returns HTTP 400 with INVALID_AGENT", async () => {
  const fakeRepo = { async createAgent() {} };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Agent",
        status: "disabled", // Only "active" | "inactive"
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AGENT");
    assert.match(body.error.message, /Invalid status/);
  });
});

test("POST /api/v1/agents: invalid environment returns HTTP 400 with INVALID_AGENT", async () => {
  const fakeRepo = { async createAgent() {} };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Agent",
        environment: "sandbox", // Only "development" | "staging" | "production"
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AGENT");
    assert.match(body.error.message, /Invalid environment/);
  });
});

test("POST /api/v1/agents: malformed JSON returns HTTP 400 with INVALID_JSON", async () => {
  const fakeRepo = { async createAgent() {} };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not-valid-json ",
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_JSON");
  });
});

test("POST /api/v1/agents: repository/database failure returns HTTP 500 without leaking raw DB error", async () => {
  const fakeRepo = {
    async createAgent() {
      throw new Error("violates unique constraint pkey");
    },
  };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Failing Agent" }),
    });

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "AGENT_CREATION_FAILED");
    assert.equal(body.error.message, "Failed to persist agent record");
    assert.equal(body.error.raw, undefined);
  });
});

// -----------------------------------------------------------------------------
// GET /api/v1/agents/:id
// -----------------------------------------------------------------------------

test("GET /api/v1/agents/:id: valid existing agent returns HTTP 200 with agent record", async () => {
  const mockAgent = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    name: "Customer Support Agent",
    description: "Support desk bot",
    status: "active",
    environment: "production",
    metadata: {},
    created_at: "2026-09-26T12:00:00.000Z",
    updated_at: "2026-09-26T12:00:00.000Z",
  };

  const fakeRepo = {
    async getAgentById(id) {
      if (id === mockAgent.id) return mockAgent;
      return null;
    },
  };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${mockAgent.id}`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.agent, mockAgent);
  });
});

test("GET /api/v1/agents/:id: unknown UUID returns HTTP 404 with AGENT_NOT_FOUND", async () => {
  const fakeRepo = {
    async getAgentById() {
      return null;
    },
  };

  const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${nonExistentUuid}`);

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "AGENT_NOT_FOUND");
    assert.match(body.error.message, /not found/);
  });
});

test("GET /api/v1/agents/:id: invalid UUID format returns HTTP 400 with INVALID_AGENT_ID", async () => {
  const fakeRepo = { async getAgentById() {} };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/not-a-uuid-12345`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AGENT_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/agents/:id: repository/database failure returns HTTP 500 without leaking error", async () => {
  const fakeRepo = {
    async getAgentById() {
      throw new Error("connection terminated unexpectedly");
    },
  };

  const validUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${validUuid}`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "AGENT_RETRIEVAL_FAILED");
    assert.equal(body.error.message, "Failed to retrieve agent record");
  });
});

// -----------------------------------------------------------------------------
// GET /api/v1/agents
// -----------------------------------------------------------------------------

test("GET /api/v1/agents: successful list returns HTTP 200 with array of agents", async () => {
  const mockAgents = [
    { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Agent 1" },
    { id: "4ba85f64-5717-4562-b3fc-2c963f66afa7", name: "Agent 2" },
  ];

  const fakeRepo = {
    async listAgents() {
      return mockAgents;
    },
  };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.agents, mockAgents);
  });
});

test("GET /api/v1/agents: pagination returns default page=1, limit=20 and pagination metadata", async () => {
  const mockAgents = Array.from({ length: 5 }, (_, i) => ({
    id: `3fa85f64-5717-4562-b3fc-2c963f66af0${i}`,
    name: `Agent ${i}`,
  }));

  let receivedOptions = null;
  const fakeRepo = {
    async listAgents(opts) {
      receivedOptions = opts;
      return {
        items: mockAgents,
        hasMore: false,
      };
    },
  };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.agents, mockAgents);
    assert.deepEqual(body.data.pagination, {
      page: 1,
      limit: 20,
      hasMore: false,
    });
    assert.deepEqual(receivedOptions, { page: 1, limit: 20 });
  });
});

test("GET /api/v1/agents: pagination respects custom page and limit query params", async () => {
  let receivedOptions = null;
  const fakeRepo = {
    async listAgents(opts) {
      receivedOptions = opts;
      return {
        items: [{ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Agent Paged" }],
        hasMore: true,
      };
    },
  };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents?page=2&limit=50`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.pagination.page, 2);
    assert.equal(body.data.pagination.limit, 50);
    assert.equal(body.data.pagination.hasMore, true);
    assert.deepEqual(receivedOptions, { page: 2, limit: 50 });
  });
});

test("GET /api/v1/agents: rejects invalid pagination params with HTTP 400 INVALID_PAGINATION", async () => {
  const fakeRepo = { async listAgents() {} };

  await withCustomServer({ agentRepository: fakeRepo }, async (baseUrl) => {
    const badQueries = [
      "page=0",
      "page=-1",
      "page=abc",
      "page=1.5",
      "limit=0",
      "limit=-10",
      "limit=101",
      "limit=xyz",
    ];

    for (const q of badQueries) {
      const res = await fetch(`${baseUrl}/api/v1/agents?${q}`);
      assert.equal(res.status, 400, `Expected 400 for query: ${q}`);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "INVALID_PAGINATION");
    }
  });
});


// -----------------------------------------------------------------------------
// Offline / Unconfigured Supabase Behavior
// -----------------------------------------------------------------------------

test("Offline mode: when Supabase is not configured, endpoints return HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    // When default supabase is null (offline/unconfigured):
    const postRes = await fetch(`${baseUrl}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Offline Agent" }),
    });
    assert.equal(postRes.status, 503);
    const postBody = await postRes.json();
    assert.equal(postBody.success, false);
    assert.equal(postBody.error.code, "SUPABASE_NOT_CONFIGURED");

    const getListRes = await fetch(`${baseUrl}/api/v1/agents`);
    assert.equal(getListRes.status, 503);
    const getListBody = await getListRes.json();
    assert.equal(getListBody.success, false);
    assert.equal(getListBody.error.code, "SUPABASE_NOT_CONFIGURED");

    const getOneRes = await fetch(`${baseUrl}/api/v1/agents/3fa85f64-5717-4562-b3fc-2c963f66afa6`);
    assert.equal(getOneRes.status, 503);
    const getOneBody = await getOneRes.json();
    assert.equal(getOneBody.success, false);
    assert.equal(getOneBody.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});
