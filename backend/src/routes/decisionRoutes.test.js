import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import app from "../app.js";

// Helper to run ephemeral HTTP server for integration tests without hardcoding ports
async function withServer(fn) {
  const server = http.createServer(app);
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
