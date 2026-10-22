import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

let server;
let baseUrl;

before(async () => {
  // Start server on an ephemeral port (port 0)
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  // Ensure the server closes cleanly
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test("Pipeline Contract - Scenario A (Bulk deletion): blocks delete_customers with count 147 via bulk_delete_guard", async () => {
  const requestBody = {
    agentId: "crm-cleanup-agent",
    toolId: "customer_crm",
    operation: "delete_customers",
    parameters: {
      count: 147,
    },
  };

  const response = await fetch(`${baseUrl}/api/v1/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  assert.equal(response.status, 200);
  const json = await response.json();

  // ApiResponse structure
  assert.equal(json.success, true);
  assert.equal(json.statusCode, 200);
  assert.ok(json.data);

  // Scenario A governance requirements
  assert.equal(json.data.decision, "BLOCK");
  assert.equal(json.data.policyId, "bulk_delete_guard");
  assert.equal(json.data.riskAssessment.score, 100);
  assert.equal(json.data.riskAssessment.level, "CRITICAL");
  assert.equal(json.data.executionStatus, "PREVENTED");
  assert.equal(json.data.executionResult, null);
});

test("Pipeline Contract - Scenario B (External email): requires approval for send_emails with count 38 to external destination", async () => {
  const requestBody = {
    agentId: "email-agent",
    toolId: "email_service",
    operation: "send_emails",
    parameters: {
      count: 38,
      destination: "external",
    },
  };

  const response = await fetch(`${baseUrl}/api/v1/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  assert.equal(response.status, 200);
  const json = await response.json();

  // ApiResponse structure
  assert.equal(json.success, true);
  assert.equal(json.statusCode, 200);
  assert.ok(json.data);

  // Scenario B governance requirements
  assert.equal(json.data.decision, "APPROVAL_REQUIRED");
  assert.equal(json.data.policyId, "external_email_review");
  assert.equal(json.data.riskAssessment.score, 58);
  assert.equal(json.data.riskAssessment.level, "MEDIUM");
  assert.equal(json.data.executionStatus, "PENDING_APPROVAL");
  assert.equal(json.data.executionResult, null);
});

test("Pipeline Contract - Scenario C (Knowledge-base read): allows and executes read with count 12", async () => {
  const requestBody = {
    agentId: "research-agent",
    toolId: "knowledge_base",
    operation: "read",
    parameters: {
      count: 12,
    },
  };

  const response = await fetch(`${baseUrl}/api/v1/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  assert.equal(response.status, 200);
  const json = await response.json();

  // ApiResponse structure
  assert.equal(json.success, true);
  assert.equal(json.statusCode, 200);
  assert.ok(json.data);

  // Scenario C governance requirements
  assert.equal(json.data.decision, "ALLOW");
  assert.equal(json.data.policyId, "standard_risk_allow");
  assert.equal(json.data.riskAssessment.score, 12);
  assert.equal(json.data.riskAssessment.level, "LOW");
  assert.equal(json.data.executionStatus, "EXECUTED");

  // Sample result from the registered knowledge-base mock tool
  assert.ok(json.data.executionResult);
  assert.equal(json.data.executionResult.source, "knowledge_base");
  assert.equal(json.data.executionResult.operation, "read");
  assert.ok(Array.isArray(json.data.executionResult.documents));
  assert.ok(json.data.executionResult.documents.length > 0);
});

test("Pipeline Contract - Unknown tools: allowed by risk/policy but never executed (fails closed)", async () => {
  const requestBody = {
    agentId: "random-agent",
    toolId: "unregistered_external_tool",
    operation: "read_stats",
    parameters: {
      count: 5,
    },
  };

  const response = await fetch(`${baseUrl}/api/v1/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  assert.equal(response.status, 200);
  const json = await response.json();

  // Policy allows low risk
  assert.equal(json.data.decision, "ALLOW");
  assert.equal(json.data.policyId, "standard_risk_allow");

  // Governed executor fails closed on unregistered tool
  assert.equal(json.data.executionStatus, "UNSUPPORTED_TOOL");
  assert.equal(json.data.executionResult, null);
});

test("Pipeline Contract - Validation: rejects missing required fields with HTTP 400", async () => {
  // Missing agentId
  const missingAgent = {
    toolId: "knowledge_base",
    operation: "read",
  };

  const response = await fetch(`${baseUrl}/api/v1/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(missingAgent),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.message, /agentId is required/);
});

test("Pipeline Contract - Validation: rejects malformed request bodies with HTTP 400", async () => {
  const response = await fetch(`${baseUrl}/api/v1/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["not", "an", "object"]),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.message, /must be a.*object/);
});

test("Pipeline Contract - Validation: rejects negative count parameter with HTTP 400", async () => {
  const negativeCount = {
    agentId: "research-agent",
    toolId: "knowledge_base",
    operation: "read",
    parameters: { count: -10 },
  };

  const response = await fetch(`${baseUrl}/api/v1/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(negativeCount),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.message, /non-negative integer/);
});
