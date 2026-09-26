import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import express from "express";
import { createDecisionRoutes } from "./decisionRoutes.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { DecisionEngine } from "../decision/decisionEngine.js";

// Helper to run ephemeral HTTP server for integration tests in isolated offline mode
async function withServer(fn) {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/v1", createDecisionRoutes({ supabaseClient: null }));
  testApp.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${req.method} ${req.originalUrl} not found`,
      },
    });
  });
  testApp.use(errorHandler);

  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}


test("TEST 1: LOW-risk action -> HTTP 200, success === true, standard_risk_allow", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "demo-agent",
        actionType: "read",
        target: "knowledge-base",
        description: "Read internal knowledge articles",
        scope: { type: "bulk", count: 12 },
        destination: { type: "internal", value: "knowledge-base" },
        environment: "production",
        sensitivity: { level: "internal" },
        financialImpact: 0,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.policy.decision, "ALLOW");
    assert.equal(body.data.policy.policyCode, "standard_risk_allow");
    assert.equal(body.data.policy.requiresHumanApproval, false);
    assert.ok(body.data.action.id);
  });
});

test("TEST 2: HIGH-risk action -> HTTP 200, APPROVAL_REQUIRED, high_risk_human_approval", async () => {
  await withServer(async (baseUrl) => {
    // Write in production (15) + sensitive (20) + bulk 10 (20) = 55 (HIGH)
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "ops-agent",
        actionType: "write",
        target: "crm.profiles",
        description: "Update sensitive customer profiles",
        scope: { type: "bulk", count: 10 },
        environment: "production",
        sensitivity: { level: "sensitive" },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.risk.level, "HIGH");
    assert.equal(body.data.policy.decision, "APPROVAL_REQUIRED");
    assert.equal(body.data.policy.policyCode, "high_risk_human_approval");
    assert.equal(body.data.policy.requiresHumanApproval, true);
  });
});

test("TEST 3: CRITICAL bulk delete -> HTTP 200, score 100, CRITICAL, BLOCK, bulk_delete_guard", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "cleanup-agent",
        actionType: "delete",
        target: "crm.customers",
        description: "Delete 147 CRM customers",
        scope: { type: "bulk", count: 147 },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.risk.score, 100);
    assert.equal(body.data.risk.level, "CRITICAL");
    assert.equal(body.data.policy.decision, "BLOCK");
    assert.equal(body.data.policy.policyCode, "bulk_delete_guard");
    assert.equal(body.data.policy.requiresHumanApproval, false);
  });
});

test("TEST 4: External high-risk send -> HTTP 200, APPROVAL_REQUIRED, external_email_review", async () => {
  await withServer(async (baseUrl) => {
    // Send + external (20) + bulk 25 (35) = 55 (HIGH) -> external_email_review
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "outreach-agent",
        actionType: "send",
        target: "crm.leads",
        description: "Send emails to leads",
        scope: { type: "bulk", count: 25 },
        destination: { type: "external", value: "leads@example.com" },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.policy.decision, "APPROVAL_REQUIRED");
    assert.equal(body.data.policy.policyCode, "external_email_review");
    assert.equal(body.data.policy.requiresHumanApproval, true);
  });
});

test("TEST 5: Invalid action -> HTTP 400, success === false, error.code === INVALID_ACTION", async () => {
  await withServer(async (baseUrl) => {
    // Missing required agentId and description
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: "read",
        target: "knowledge-base",
      }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_ACTION");
    assert.ok(body.error.message.includes("agentId"));
  });
});

test("TEST 6: Missing/empty body -> HTTP 400, error.code === INVALID_ACTION", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_ACTION");
  });
});

test("TEST 7: Malformed JSON -> HTTP 400, error.code === INVALID_JSON", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not-valid-json: true",
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_JSON");
    assert.equal(body.error.message, "Request body must contain valid JSON");
  });
});

test("TEST 8: Unknown route -> HTTP 404, NOT_FOUND", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/does-not-exist`, {
      method: "GET",
    });

    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "NOT_FOUND");
  });
});

// TASK 8 INTEGRATION TESTS
test("TEST 9 (Task 8): LOW-risk ALLOW produces integrated Audit Event with DECISION_MADE", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "audit-demo-agent",
        actionType: "read",
        target: "crm.customers",
        description: "Read customer profile",
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(body.data.audit, "Audit event must be present in response data");

    const { action, risk, policy, audit } = body.data;

    assert.equal(audit.status, "DECISION_MADE");
    assert.equal(audit.actionId, action.id);
    assert.equal(audit.agentId, action.agentId);
    assert.equal(audit.actionType, action.actionType);
    assert.equal(audit.target, action.target);

    assert.equal(audit.risk.score, risk.score);
    assert.equal(audit.risk.level, risk.level);

    assert.equal(audit.policy.decision, policy.decision);
    assert.equal(audit.policy.policyCode, policy.policyCode);
    assert.equal(audit.policy.requiresHumanApproval, false);
    assert.ok(audit.id);
    assert.ok(audit.createdAt);
  });
});

test("TEST 10 (Task 8): HIGH-risk APPROVAL produces audit status AWAITING_APPROVAL", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "ops-agent",
        actionType: "write",
        target: "crm.profiles",
        description: "Update sensitive customer profiles",
        scope: { type: "bulk", count: 10 },
        environment: "production",
        sensitivity: { level: "sensitive" },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.policy.decision, "APPROVAL_REQUIRED");
    assert.equal(body.data.audit.status, "AWAITING_APPROVAL");
    assert.equal(body.data.audit.policy.requiresHumanApproval, true);
  });
});

test("TEST 11 (Task 8): CRITICAL bulk delete produces audit status BLOCKED with bulk_delete_guard", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "cleanup-agent",
        actionType: "delete",
        target: "crm.customers",
        description: "Delete 147 CRM customers",
        scope: { type: "bulk", count: 147 },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.risk.score, 100);
    assert.equal(body.data.risk.level, "CRITICAL");
    assert.equal(body.data.policy.decision, "BLOCK");
    assert.equal(body.data.policy.policyCode, "bulk_delete_guard");

    assert.equal(body.data.audit.status, "BLOCKED");
    assert.equal(body.data.audit.policy.policyCode, "bulk_delete_guard");
    assert.equal(body.data.audit.actionId, body.data.action.id);
  });
});

test("TEST 12 (Task 8): External high-risk send produces audit status AWAITING_APPROVAL with external_email_review", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "outreach-agent",
        actionType: "send",
        target: "crm.leads",
        description: "Send emails to leads",
        scope: { type: "bulk", count: 25 },
        destination: { type: "external", value: "leads@example.com" },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.policy.decision, "APPROVAL_REQUIRED");
    assert.equal(body.data.policy.policyCode, "external_email_review");

    assert.equal(body.data.audit.status, "AWAITING_APPROVAL");
    assert.equal(body.data.audit.policy.policyCode, "external_email_review");
  });
});

test("TEST 13 (Task 8): Audit identity consistency — audit.actionId strictly equals action.id", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "identity-agent",
        actionType: "read",
        target: "crm.leads",
        description: "Verify identity linking",
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.data.action.id);
    assert.equal(body.data.audit.actionId, body.data.action.id);
  });
});

test("TEST 14 (Task 8): Audit risk consistency — audit risk reflects exact evaluated score, level, and factors", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "risk-agent",
        actionType: "delete",
        target: "crm.leads",
        description: "Delete 10 leads",
        scope: { type: "bulk", count: 10 },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.audit.risk, body.data.risk);
    assert.equal(body.data.audit.risk.score, 70);
    assert.equal(body.data.audit.risk.level, "HIGH");
  });
});

test("TEST 15 (Task 8): Audit policy consistency — audit policy reflects exact decision, policyCode, reason, requiresHumanApproval", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "policy-agent",
        actionType: "read",
        target: "kb",
        description: "Read docs",
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.audit.policy, body.data.policy);
    assert.equal(body.data.audit.policy.decision, "ALLOW");
    assert.equal(body.data.audit.policy.policyCode, "standard_risk_allow");
    assert.equal(body.data.audit.policy.requiresHumanApproval, false);
  });
});

// Helper for testing custom route dependency injection
import { createMockSupabaseClient } from "../repositories/mockSupabaseClient.js";

async function withCustomRouter(options = {}, fn) {

  const customApp = express();
  customApp.use(express.json());
  const resolvedOptions = {
    supabaseClient: null,
    ...options,
  };
  customApp.use("/api/v1", createDecisionRoutes(resolvedOptions));
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


test("TEST 16 (Tasks 15 & 16): When Supabase client is configured, Action, Decision, and Audit repositories persist data", async () => {
  const validAgentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const mockClient = createMockSupabaseClient({ data: { id: "persisted-id", status: "active" } });

  await withCustomRouter({ supabaseClient: mockClient }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: validAgentId,
        actionType: "read",
        target: "db.customers",
        description: "Read customer directory",
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(body.data.action);
    assert.ok(body.data.risk);
    assert.ok(body.data.policy);
    assert.ok(body.data.audit);

    // Verify mock client calls for all 3 tables
    assert.equal(mockClient.calls.tables.includes("actions"), true);
    assert.equal(mockClient.calls.tables.includes("decisions"), true);
    assert.equal(mockClient.calls.tables.includes("audit_events"), true);

    // Verify action payload inserted
    const actionInsert = mockClient.calls.inserts.find((ins) => ins.agent_id === validAgentId);
    assert.ok(actionInsert);
    assert.equal(actionInsert.action_type, "read");
    assert.equal(actionInsert.target, "db.customers");

    // Verify decision payload inserted
    const decisionInsert = mockClient.calls.inserts.find((ins) => ins.action_id === body.data.action.id);
    assert.ok(decisionInsert);
    assert.equal(decisionInsert.policy_decision, "ALLOW");
    assert.equal(decisionInsert.policy_code, "standard_risk_allow");
    assert.equal("decision" in decisionInsert, false);
    assert.equal("reason" in decisionInsert, false);

    // Verify audit event payload inserted
    const auditInsert = mockClient.calls.inserts.find((ins) => ins.action_id === body.data.action.id && "policy_decision" in ins && "status" in ins);
    assert.ok(auditInsert);
    assert.equal(auditInsert.action_id, body.data.action.id);
    assert.equal(auditInsert.agent_id, validAgentId);
    assert.equal(auditInsert.status, "DECISION_MADE");
    assert.equal(auditInsert.policy_decision, "ALLOW");
  });
});

test("TEST 17 (Task 15): Action persistence failure returns HTTP 500 with code ACTION_PERSISTENCE_FAILED", async () => {
  const actionRepoFail = {
    async createAction() {
      throw new Error("DB write failed on actions table");
    },
  };
  const decisionRepoSpy = {
    called: false,
    async createDecision() {
      this.called = true;
    },
  };

  await withCustomRouter(
    { actionRepository: actionRepoFail, decisionRepository: decisionRepoSpy },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          actionType: "read",
          target: "db",
          description: "Read test",
        }),
      });

      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "ACTION_PERSISTENCE_FAILED");
      assert.equal(decisionRepoSpy.called, false, "Decision should not be persisted if action persistence fails");
    }
  );
});

test("TEST 18 (Task 15): Decision persistence failure returns HTTP 500 with code DECISION_PERSISTENCE_FAILED", async () => {
  const actionRepoSuccess = {
    called: false,
    async createAction(a) {
      this.called = true;
      return a;
    },
  };
  const decisionRepoFail = {
    async createDecision() {
      throw new Error("DB write failed on decisions table");
    },
  };

  await withCustomRouter(
    { actionRepository: actionRepoSuccess, decisionRepository: decisionRepoFail },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          actionType: "read",
          target: "db",
          description: "Read test",
        }),
      });

      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "DECISION_PERSISTENCE_FAILED");
      assert.equal(actionRepoSuccess.called, true, "Action was persisted before decision persistence failed");
    }
  );
});

test("TEST 19 (Task 15): No persistence occurs before action validation succeeds", async () => {
  const mockClient = createMockSupabaseClient({ data: { id: "ok" } });

  await withCustomRouter({ supabaseClient: mockClient }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Invalid action - missing agentId and description
        actionType: "invalid_type",
      }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "INVALID_ACTION");
    assert.equal(mockClient.calls.inserts.length, 0, "No database inserts should happen on invalid action");
  });
});

test("TEST 20 (Task 15): No decision or action persistence occurs if DecisionEngine throws", async () => {
  const validAgentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const mockClient = createMockSupabaseClient({ data: { id: validAgentId, status: "active" } });
  const failingEngine = {
    evaluate() {
      throw new Error("Engine unexpected failure");
    },
  };

  await withCustomRouter({ decisionEngine: failingEngine, supabaseClient: mockClient }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: validAgentId,
        actionType: "read",
        target: "db",
        description: "Valid action payload",
      }),
    });

    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error.code, "DECISION_EVALUATION_FAILED");
    assert.equal(mockClient.calls.inserts.length, 0, "No inserts should occur if evaluation fails");
  });
});

test("TEST 21 (Task 16): Audit persistence failure returns HTTP 500 with code AUDIT_PERSISTENCE_FAILED", async () => {
  const actionRepo = { async createAction(a) { return a; } };
  const decisionRepo = { async createDecision(d) { return d; } };
  const auditRepoFail = {
    async createAuditEvent() {
      throw new Error("DB connection terminated during audit_events insert");
    },
  };

  await withCustomRouter(
    { actionRepository: actionRepo, decisionRepository: decisionRepo, auditEventRepository: auditRepoFail },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-audit-fail",
          actionType: "read",
          target: "kb",
          description: "Test audit persistence failure",
        }),
      });

      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "AUDIT_PERSISTENCE_FAILED");
      assert.equal(body.error.message, "Failed to persist audit event");
    }
  );
});

test("TEST 22 (Task 16): Persistence order verification — action, then decision, then audit", async () => {
  const executionOrder = [];

  const actionRepo = {
    async createAction(a) {
      executionOrder.push("ACTION_PERSISTED");
      return a;
    },
  };
  const decisionRepo = {
    async createDecision(d) {
      executionOrder.push("DECISION_PERSISTED");
      return d;
    },
  };
  const auditRepo = {
    async createAuditEvent(ev) {
      executionOrder.push("AUDIT_PERSISTED");
      return ev;
    },
  };

  await withCustomRouter(
    { actionRepository: actionRepo, decisionRepository: decisionRepo, auditEventRepository: auditRepo },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-order-test",
          actionType: "read",
          target: "kb",
          description: "Order verification",
        }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(executionOrder, [
        "ACTION_PERSISTED",
        "DECISION_PERSISTED",
        "AUDIT_PERSISTED",
      ]);
    }
  );
});

test("TEST 23 (Task 16): If Action persistence fails, audit persistence does not occur", async () => {
  const actionRepoFail = {
    async createAction() {
      throw new Error("Action write failure");
    },
  };
  const auditRepoSpy = {
    called: false,
    async createAuditEvent() {
      this.called = true;
    },
  };

  await withCustomRouter(
    { actionRepository: actionRepoFail, auditEventRepository: auditRepoSpy },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-test",
          actionType: "read",
          target: "kb",
          description: "Action fail cascade test",
        }),
      });

      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.error.code, "ACTION_PERSISTENCE_FAILED");
      assert.equal(auditRepoSpy.called, false);
    }
  );
});

test("TEST 24 (Task 16): If Decision persistence fails, audit persistence does not occur", async () => {
  const actionRepo = { async createAction(a) { return a; } };
  const decisionRepoFail = {
    async createDecision() {
      throw new Error("Decision write failure");
    },
  };
  const auditRepoSpy = {
    called: false,
    async createAuditEvent() {
      this.called = true;
    },
  };

  await withCustomRouter(
    { actionRepository: actionRepo, decisionRepository: decisionRepoFail, auditEventRepository: auditRepoSpy },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-test",
          actionType: "read",
          target: "kb",
          description: "Decision fail cascade test",
        }),
      });

      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.error.code, "DECISION_PERSISTENCE_FAILED");
      assert.equal(auditRepoSpy.called, false);
    }
  );
});

test("TEST 25 (Task 16): Audit repository receives the exact audit event object with all security fields", async () => {
  let receivedAuditEvent;
  const actionRepo = { async createAction(a) { return a; } };
  const decisionRepo = { async createDecision(d) { return d; } };
  const auditRepo = {
    async createAuditEvent(ev) {
      receivedAuditEvent = ev;
      return ev;
    },
  };

  await withCustomRouter(
    { actionRepository: actionRepo, decisionRepository: decisionRepo, auditEventRepository: auditRepo },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-audit-inspector",
          actionType: "read",
          target: "kb.articles",
          description: "Inspect audit payload",
        }),
      });

      assert.equal(response.status, 200);
      const body = await response.json();

      assert.ok(receivedAuditEvent);
      assert.equal(receivedAuditEvent.actionId, body.data.action.id);
      assert.equal(receivedAuditEvent.agentId, "agent-audit-inspector");
      assert.equal(receivedAuditEvent.target, "kb.articles");
      assert.equal(receivedAuditEvent.status, "DECISION_MADE");
      assert.equal(receivedAuditEvent.policy.decision, "ALLOW");
      assert.equal(receivedAuditEvent.risk.level, "LOW");
    }
  );
});

test("TEST 26 (Task 17 Hardening): Audit creation/validation failure prevents audit persistence", async () => {
  const actionRepo = { async createAction(a) { return a; } };
  const decisionRepo = { async createDecision(d) { return d; } };
  const auditRepoSpy = {
    called: false,
    async createAuditEvent() {
      this.called = true;
    },
  };

  // Mock engine that produces an invalid policy output causing audit validation to fail
  const faultyEngine = {
    evaluate(action) {
      return {
        action,
        risk: { score: 10, level: "LOW", factors: [] },
        policy: {
          decision: "INVALID_POLICY_DECISION",
          policyCode: "test",
          reason: "test",
          requiresHumanApproval: false,
        },
      };
    },
  };

  await withCustomRouter(
    { decisionEngine: faultyEngine, actionRepository: actionRepo, decisionRepository: decisionRepo, auditEventRepository: auditRepoSpy },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-faulty",
          actionType: "read",
          target: "kb",
          description: "Trigger audit validation error",
        }),
      });

      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.error.code, "AUDIT_EVENT_CREATION_FAILED");
      assert.equal(auditRepoSpy.called, false, "Audit persistence must not be called when audit creation/validation fails");
    }
  );
});

// -----------------------------------------------------------------------------
// Task 23: Agent Context & Action-to-Agent Validation
// -----------------------------------------------------------------------------

test("TEST 27 (Task 23): Valid registered active agent allows decision flow to proceed and persist", async () => {
  const validAgentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const agentRepo = {
    async getAgentById(id) {
      if (id === validAgentId) {
        return { id: validAgentId, status: "active", name: "Active Agent" };
      }
      return null;
    },
  };
  const actionRepo = {
    called: false,
    async createAction(a) {
      this.called = true;
      return a;
    },
  };

  await withCustomRouter({ agentRepository: agentRepo, actionRepository: actionRepo }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: validAgentId,
        actionType: "read",
        target: "db.records",
        description: "Read records by active agent",
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.action.agentId, validAgentId);
    assert.equal(actionRepo.called, true, "Action was persisted for valid active agent");
  });
});

test("TEST 28 (Task 23): Invalid agent UUID returns HTTP 400 INVALID_AGENT_ID and halts pipeline", async () => {
  const engineSpy = {
    called: false,
    evaluate() {
      this.called = true;
    },
  };
  const agentRepoSpy = {
    called: false,
    async getAgentById() {
      this.called = true;
    },
  };

  await withCustomRouter(
    { decisionEngine: engineSpy, agentRepository: agentRepoSpy },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "not-a-valid-uuid",
          actionType: "read",
          target: "db.records",
          description: "Read records with bad UUID",
        }),
      });

      assert.equal(response.status, 400);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "INVALID_AGENT_ID");
      assert.equal(engineSpy.called, false, "Decision engine must not be called");
      assert.equal(agentRepoSpy.called, false, "Database lookup must not be attempted before UUID validation");
    }
  );
});

test("TEST 29 (Task 23): Unknown agent returns HTTP 404 AGENT_NOT_FOUND and does not evaluate or persist", async () => {
  const unknownUuid = "00000000-0000-0000-0000-000000000000";
  const engineSpy = {
    called: false,
    evaluate() {
      this.called = true;
    },
  };
  const actionRepoSpy = {
    called: false,
    async createAction() {
      this.called = true;
    },
  };
  const agentRepo = {
    async getAgentById() {
      return null;
    },
  };

  await withCustomRouter(
    { decisionEngine: engineSpy, agentRepository: agentRepo, actionRepository: actionRepoSpy },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: unknownUuid,
          actionType: "read",
          target: "db.records",
          description: "Read records by non-existent agent",
        }),
      });

      assert.equal(response.status, 404);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "AGENT_NOT_FOUND");
      assert.equal(engineSpy.called, false, "Decision engine must not run for unknown agent");
      assert.equal(actionRepoSpy.called, false, "Action must not be persisted for unknown agent");
    }
  );
});

test("TEST 30 (Task 23): Inactive agent returns HTTP 403 AGENT_INACTIVE and halts pipeline", async () => {
  const inactiveAgentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const engineSpy = {
    called: false,
    evaluate() {
      this.called = true;
    },
  };
  const actionRepoSpy = {
    called: false,
    async createAction() {
      this.called = true;
    },
  };
  const agentRepo = {
    async getAgentById(id) {
      if (id === inactiveAgentId) {
        return { id: inactiveAgentId, status: "inactive", name: "Disabled Agent" };
      }
      return null;
    },
  };

  await withCustomRouter(
    { decisionEngine: engineSpy, agentRepository: agentRepo, actionRepository: actionRepoSpy },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: inactiveAgentId,
          actionType: "read",
          target: "db.records",
          description: "Read records by inactive agent",
        }),
      });

      assert.equal(response.status, 403);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "AGENT_INACTIVE");
      assert.equal(engineSpy.called, false, "Decision engine must not run for inactive agent");
      assert.equal(actionRepoSpy.called, false, "Action must not be persisted for inactive agent");
    }
  );
});

test("TEST 31 (Task 23): Agent repository failure returns HTTP 500 without running decision engine", async () => {
  const validAgentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const engineSpy = {
    called: false,
    evaluate() {
      this.called = true;
    },
  };
  const agentRepoFail = {
    async getAgentById() {
      throw new Error("PostgreSQL connection failure");
    },
  };

  await withCustomRouter(
    { decisionEngine: engineSpy, agentRepository: agentRepoFail },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: validAgentId,
          actionType: "read",
          target: "db.records",
          description: "Read records during DB failure",
        }),
      });

      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "AGENT_VERIFICATION_FAILED");
      assert.equal(engineSpy.called, false, "Decision engine must not run if agent verification fails");
    }
  );
});

test("TEST 32 (Task 23): Offline mode works without requiring Supabase or agent lookup", async () => {
  await withCustomRouter({ supabaseClient: null }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "arbitrary-string-id",
        actionType: "read",
        target: "docs",
        description: "Offline evaluation",
        environment: "development",
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.policy.decision, "ALLOW");
  });
});

test("tool reference without a grant is denied before a low-risk ALLOW can be produced", async () => {
  const agentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const toolId = "4ba85f64-5717-4562-b3fc-2c963f66afa7";
  const engine = { called: false, evaluate() { this.called = true; return { policy: { decision: "ALLOW" } }; } };
  const permissionService = { async checkAgentToolPermission() { return { allowed: false, permission: null }; } };
  await withCustomRouter({
    decisionEngine: engine,
    agentRepository: { async getAgentById() { return { id: agentId, status: "active" }; } },
    permissionService,
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, tool_id: toolId, actionType: "read", target: "records", description: "Read records" }),
    });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.error.code, "PERMISSION_DENIED");
    assert.equal(engine.called, false);
  });
});

test("an explicit grant still passes through risk and policy evaluation", async () => {
  const agentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const toolId = "4ba85f64-5717-4562-b3fc-2c963f66afa7";
  const calls = { risk: false, policy: false };
  const engine = new DecisionEngine({
    riskEngine: { evaluate() { calls.risk = true; return { score: 75, level: "HIGH", factors: [] }; } },
    policyEngine: { evaluate() { calls.policy = true; return { decision: "APPROVAL_REQUIRED", policyCode: "test_high_risk", reason: "Review required", requiresHumanApproval: true }; } },
  });
  const permissionService = { async checkAgentToolPermission() { return { allowed: true, permission: { id: "grant" } }; } };
  await withCustomRouter({
    decisionEngine: engine,
    agentRepository: { async getAgentById() { return { id: agentId, status: "active" }; } },
    permissionService,
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/decisions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, toolId, actionType: "read", target: "records", description: "Read records" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.risk.level, "HIGH");
    assert.equal(body.data.policy.decision, "APPROVAL_REQUIRED");
    assert.deepEqual(calls, { risk: true, policy: true });
  });
});
