import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

import app from "../app.js";
import { createAuditRoutes } from "./auditRoutes.js";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { createMockSupabaseClient } from "../repositories/mockSupabaseClient.js";
import { errorHandler } from "../middleware/errorHandler.js";

// Helper to run ephemeral HTTP server with isolated unconfigured app
async function withServer(fn) {
  return withCustomServer({ supabaseClient: null }, fn);
}


// Helper to run ephemeral HTTP server with customized options (dependency injection)
async function withCustomServer(options, fn) {
  const customApp = express();
  customApp.use(express.json());
  customApp.use("/api/v1", createAuditRoutes(options));
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
// GET /api/v1/audit-events/:id
// -----------------------------------------------------------------------------

test("GET /api/v1/audit-events/:id: successful retrieval returns HTTP 200 with audit event", async () => {
  const mockAudit = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    action_id: "e6f47738-94df-4155-9b7e-9086fa2530cb",
    agent_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
    action_type: "delete",
    target: "crm.customers",
    risk_score: 100,
    risk_level: "CRITICAL",
    risk_factors: [{ factor: "bulk_delete", weight: 40 }],
    policy_decision: "BLOCK",
    policy_code: "bulk_delete_guard",
    policy_reason: "Bulk delete exceeding limit blocked",
    requires_human_approval: false,
    status: "BLOCKED",
    metadata: {},
    created_at: "2026-09-26T12:00:00.000Z",
  };

  const mockClient = createMockSupabaseClient({ data: mockAudit });
  const repo = createAuditEventRepository(mockClient);

  await withCustomServer({ auditEventRepository: repo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/audit-events/${mockAudit.id}`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.audit, mockAudit);
  });
});

test("GET /api/v1/audit-events/:id: unknown audit event returns HTTP 404 with AUDIT_EVENT_NOT_FOUND", async () => {
  const fakeRepo = {
    async getAuditEventById() {
      return null;
    },
  };

  const unknownUuid = "00000000-0000-0000-0000-000000000000";

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/audit-events/${unknownUuid}`);

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "AUDIT_EVENT_NOT_FOUND");
    assert.match(body.error.message, /not found/);
  });
});

test("GET /api/v1/audit-events/:id: invalid UUID format returns HTTP 400 with INVALID_AUDIT_EVENT_ID", async () => {
  const fakeRepo = { async getAuditEventById() {} };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/audit-events/not-a-valid-uuid`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AUDIT_EVENT_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/audit-events/:id: repository failure returns HTTP 500 with AUDIT_EVENT_RETRIEVAL_FAILED", async () => {
  const fakeRepo = {
    async getAuditEventById() {
      throw new Error("fatal query error");
    },
  };

  const validUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/audit-events/${validUuid}`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "AUDIT_EVENT_RETRIEVAL_FAILED");
    assert.equal(body.error.message, "Failed to retrieve audit event record");
    assert.equal(body.error.raw, undefined);
  });
});

test("GET /api/v1/audit-events/:id: when Supabase not configured returns HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/audit-events/3fa85f64-5717-4562-b3fc-2c963f66afa6`);

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});

// -----------------------------------------------------------------------------
// GET /api/v1/actions/:actionId/audit-events
// -----------------------------------------------------------------------------

test("GET /api/v1/actions/:actionId/audit-events: successful list returns HTTP 200 with auditEvents array", async () => {
  const actionUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  const mockEvents = [
    { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", action_id: actionUuid, status: "DECISION_MADE" },
    { id: "4ba85f64-5717-4562-b3fc-2c963f66afa7", action_id: actionUuid, status: "EXECUTED" },
  ];

  const fakeRepo = {
    async listAuditEventsByActionId(actionId) {
      if (actionId === actionUuid) return mockEvents;
      return [];
    },
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/audit-events`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.auditEvents, mockEvents);
  });
});

test("GET /api/v1/actions/:actionId/audit-events: empty list returns HTTP 200 with empty array", async () => {
  const actionUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  const fakeRepo = {
    async listAuditEventsByActionId() {
      return [];
    },
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/audit-events`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.auditEvents, []);
  });
});

test("GET /api/v1/actions/:actionId/audit-events: invalid action UUID returns HTTP 400 with INVALID_ACTION_ID", async () => {
  const fakeRepo = { async listAuditEventsByActionId() {} };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/not-a-valid-action-uuid/audit-events`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_ACTION_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/actions/:actionId/audit-events: repository failure returns HTTP 500 with AUDIT_EVENT_LIST_FAILED", async () => {
  const fakeRepo = {
    async listAuditEventsByActionId() {
      throw new Error("read failure");
    },
  };

  const actionUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/audit-events`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "AUDIT_EVENT_LIST_FAILED");
    assert.equal(body.error.message, "Failed to list audit events for action");
  });
});

test("GET /api/v1/actions/:actionId/audit-events: when Supabase not configured returns HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/e6f47738-94df-4155-9b7e-9086fa2530cb/audit-events`);

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});

// -----------------------------------------------------------------------------
// GET /api/v1/agents/:agentId/audit-events
// -----------------------------------------------------------------------------

test("GET /api/v1/agents/:agentId/audit-events: successful list returns HTTP 200 with auditEvents array", async () => {
  const agentUuid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
  const mockEvents = [
    { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", agent_id: agentUuid, status: "DECISION_MADE" },
  ];

  const fakeRepo = {
    async listAuditEventsByAgentId(agentId) {
      if (agentId === agentUuid) return mockEvents;
      return [];
    },
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/audit-events`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.auditEvents, mockEvents);
  });
});

test("GET /api/v1/actions/:actionId/audit-events: supports pagination params and metadata", async () => {
  const actionUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  let capturedOpts = null;
  const fakeRepo = {
    async listAuditEventsByActionId(actionId, opts) {
      capturedOpts = opts;
      return {
        items: [{ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", action_id: actionUuid }],
        hasMore: true,
      };
    },
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/audit-events?page=3&limit=15`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.pagination, { page: 3, limit: 15, hasMore: true });
    assert.deepEqual(capturedOpts, { page: 3, limit: 15 });
  });
});

test("GET /api/v1/actions/:actionId/audit-events: rejects invalid pagination with HTTP 400 INVALID_PAGINATION", async () => {
  const actionUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  const fakeRepo = { async listAuditEventsByActionId() {} };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/audit-events?page=-1`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_PAGINATION");
  });
});

test("GET /api/v1/agents/:agentId/audit-events: supports pagination params and metadata", async () => {
  const agentUuid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
  let capturedOpts = null;
  const fakeRepo = {
    async listAuditEventsByAgentId(agentId, opts) {
      capturedOpts = opts;
      return {
        items: [{ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", agent_id: agentUuid }],
        hasMore: false,
      };
    },
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/audit-events?page=1&limit=25`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.pagination, { page: 1, limit: 25, hasMore: false });
    assert.deepEqual(capturedOpts, { page: 1, limit: 25 });
  });
});

test("GET /api/v1/agents/:agentId/audit-events: rejects invalid pagination with HTTP 400 INVALID_PAGINATION", async () => {
  const agentUuid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
  const fakeRepo = { async listAuditEventsByAgentId() {} };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/audit-events?limit=0`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_PAGINATION");
  });
});


test("GET /api/v1/agents/:agentId/audit-events: invalid agent UUID returns HTTP 400 with INVALID_AGENT_ID", async () => {
  const fakeRepo = { async listAuditEventsByAgentId() {} };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/not-a-valid-agent-uuid/audit-events`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_AGENT_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/agents/:agentId/audit-events: repository failure returns HTTP 500 with AUDIT_EVENT_LIST_FAILED", async () => {
  const fakeRepo = {
    async listAuditEventsByAgentId() {
      throw new Error("db down");
    },
  };

  const agentUuid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/${agentUuid}/audit-events`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "AUDIT_EVENT_LIST_FAILED");
    assert.equal(body.error.message, "Failed to list audit events for agent");
  });
});

test("GET /api/v1/agents/:agentId/audit-events: when Supabase not configured returns HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/agents/a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d/audit-events`);

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});

// -----------------------------------------------------------------------------
// GET /api/v1/audit-events (Global List, Filters, Stats, Export)
// -----------------------------------------------------------------------------

test("GET /api/v1/audit-events: lists all audit events with pagination", async () => {
  const mockItems = [
    { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", action_type: "read", policy_decision: "ALLOW" },
  ];
  const fakeRepo = {
    async listAuditEvents() {
      return { items: mockItems, hasMore: false };
    },
    async getAuditEventById() {},
    async listAuditEventsByActionId() {},
    async listAuditEventsByAgentId() {},
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/audit-events?page=1&limit=10`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.auditEvents.length, 1);
    assert.ok(body.data.auditEvents[0].integrityProof);
  });
});

test("GET /api/v1/audit-events/stats: returns aggregated governance statistics", async () => {
  const fakeRepo = {
    async getAuditStats() {
      return { totalEvents: 42, decisions: { allowed: 30, blocked: 10, approvalRequired: 2 } };
    },
    async listAuditEvents() { return { items: [], hasMore: false }; },
    async getAuditEventById() {},
    async listAuditEventsByActionId() {},
    async listAuditEventsByAgentId() {},
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/audit-events/stats`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.totalEvents, 42);
  });
});

test("GET /api/v1/audit-events/export: exports CSV and JSON formats", async () => {
  const mockItems = [
    { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", action_type: "read", policy_decision: "ALLOW", target: "crm.customers" },
  ];
  const fakeRepo = {
    async listAuditEvents() {
      return { items: mockItems, hasMore: false };
    },
    async getAuditEventById() {},
    async listAuditEventsByActionId() {},
    async listAuditEventsByAgentId() {},
  };

  await withCustomServer({ auditEventRepository: fakeRepo }, async (baseUrl) => {
    // JSON export
    const jsonRes = await fetch(`${baseUrl}/api/v1/audit-events/export?format=json`);
    assert.equal(jsonRes.status, 200);
    assert.ok(jsonRes.headers.get("content-type").includes("application/json"));

    // CSV export
    const csvRes = await fetch(`${baseUrl}/api/v1/audit-events/export?format=csv`);
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get("content-type").includes("text/csv"));
    const csvText = await csvRes.text();
    assert.ok(csvText.includes("ID,Action ID,Agent ID"));
  });
});

