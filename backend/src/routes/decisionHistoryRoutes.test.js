import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

import app from "../app.js";
import { createDecisionHistoryRoutes } from "./decisionHistoryRoutes.js";
import { createDecisionRepository } from "../repositories/decisionRepository.js";
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
  customApp.use("/api/v1", createDecisionHistoryRoutes(options));
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
// GET /api/v1/decisions/:id
// -----------------------------------------------------------------------------

test("GET /api/v1/decisions/:id: successful retrieval returns HTTP 200 with decision record", async () => {
  const mockDecision = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    action_id: "e6f47738-94df-4155-9b7e-9086fa2530cb",
    risk_score: 85,
    risk_level: "CRITICAL",
    risk_factors: [{ factor: "bulk_delete", weight: 40 }],
    policy_decision: "BLOCK",
    policy_code: "critical_risk_block",
    policy_reason: "Critical risk blocked",
    requires_human_approval: false,
    metadata: {},
    created_at: "2026-09-26T12:00:00.000Z",
  };

  const mockClient = createMockSupabaseClient({ data: mockDecision });
  const repo = createDecisionRepository(mockClient);

  await withCustomServer({ decisionRepository: repo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/decisions/${mockDecision.id}`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.decision, mockDecision);
  });
});

test("GET /api/v1/decisions/:id: unknown decision returns HTTP 404 with DECISION_NOT_FOUND", async () => {
  const fakeRepo = {
    async getDecisionById() {
      return null;
    },
  };

  const unknownUuid = "00000000-0000-0000-0000-000000000000";

  await withCustomServer({ decisionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/decisions/${unknownUuid}`);

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "DECISION_NOT_FOUND");
    assert.match(body.error.message, /not found/);
  });
});

test("GET /api/v1/decisions/:id: invalid UUID format returns HTTP 400 with INVALID_DECISION_ID", async () => {
  const fakeRepo = { async getDecisionById() {} };

  await withCustomServer({ decisionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/decisions/not-a-valid-uuid`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_DECISION_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/decisions/:id: repository failure returns HTTP 500 with DECISION_RETRIEVAL_FAILED", async () => {
  const fakeRepo = {
    async getDecisionById() {
      throw new Error("connection failure");
    },
  };

  const validUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  await withCustomServer({ decisionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/decisions/${validUuid}`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "DECISION_RETRIEVAL_FAILED");
    assert.equal(body.error.message, "Failed to retrieve decision record");
    assert.equal(body.error.raw, undefined);
  });
});

test("GET /api/v1/decisions/:id: when Supabase not configured returns HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/decisions/3fa85f64-5717-4562-b3fc-2c963f66afa6`);

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});

// -----------------------------------------------------------------------------
// GET /api/v1/actions/:actionId/decision
// -----------------------------------------------------------------------------

test("GET /api/v1/actions/:actionId/decision: successful lookup returns HTTP 200 with decision record", async () => {
  const actionUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";
  const mockDecision = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    action_id: actionUuid,
    risk_score: 15,
    risk_level: "LOW",
    risk_factors: [],
    policy_decision: "ALLOW",
    policy_code: "standard_risk_allow",
    policy_reason: "Standard risk allow",
    requires_human_approval: false,
    metadata: {},
    created_at: "2026-09-26T12:00:00.000Z",
  };

  const fakeRepo = {
    async getDecisionByActionId(actionId) {
      if (actionId === actionUuid) return mockDecision;
      return null;
    },
  };

  await withCustomServer({ decisionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/decision`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.decision, mockDecision);
  });
});

test("GET /api/v1/actions/:actionId/decision: no decision for action returns HTTP 404 with DECISION_NOT_FOUND", async () => {
  const fakeRepo = {
    async getDecisionByActionId() {
      return null;
    },
  };

  const actionUuid = "00000000-0000-0000-0000-000000000000";

  await withCustomServer({ decisionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/decision`);

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "DECISION_NOT_FOUND");
    assert.match(body.error.message, /not found/);
  });
});

test("GET /api/v1/actions/:actionId/decision: invalid action UUID returns HTTP 400 with INVALID_ACTION_ID", async () => {
  const fakeRepo = { async getDecisionByActionId() {} };

  await withCustomServer({ decisionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/not-a-valid-action-uuid/decision`);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_ACTION_ID");
    assert.match(body.error.message, /Expected standard UUID/);
  });
});

test("GET /api/v1/actions/:actionId/decision: repository failure returns HTTP 500 with DECISION_RETRIEVAL_FAILED", async () => {
  const fakeRepo = {
    async getDecisionByActionId() {
      throw new Error("connection dropped");
    },
  };

  const actionUuid = "e6f47738-94df-4155-9b7e-9086fa2530cb";

  await withCustomServer({ decisionRepository: fakeRepo }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/${actionUuid}/decision`);

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "DECISION_RETRIEVAL_FAILED");
    assert.equal(body.error.message, "Failed to retrieve decision record");
  });
});

test("GET /api/v1/actions/:actionId/decision: when Supabase not configured returns HTTP 503 SUPABASE_NOT_CONFIGURED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/actions/e6f47738-94df-4155-9b7e-9086fa2530cb/decision`);

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
  });
});
