import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createToolRoutes } from "./toolRoutes.js";
import { errorHandler } from "../middleware/errorHandler.js";

async function withToolServer(options = {}, fn) {
  const mergedOptions = { supabaseClient: null, ...options };
  const customApp = express();
  customApp.use(express.json());
  customApp.use("/api/v1", createToolRoutes(mergedOptions));
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

describe("Tool Routes API", () => {
  it("GET /api/v1/tools: returns list of all mock tools with operations and schemas", async () => {
    await withToolServer({}, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/tools`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.tools));
      assert.ok(body.data.tools.length >= 6);

      const toolIds = body.data.tools.map((t) => t.id);
      assert.ok(toolIds.includes("customer_crm"));
      assert.ok(toolIds.includes("email_sender"));
      assert.ok(toolIds.includes("knowledge_base"));
      assert.ok(toolIds.includes("financial_ledger"));
    });
  });

  it("GET /api/v1/tools/:id: returns specific tool details or 404", async () => {
    await withToolServer({}, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/tools/customer_crm`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.tool.id, "customer_crm");

      const notFoundRes = await fetch(`${baseUrl}/api/v1/tools/unknown_tool_xyz`);
      assert.equal(notFoundRes.status, 404);
    });
  });

  it("POST /api/v1/tools/execute: intercepts and allows low-risk knowledgeBase read", async () => {
    await withToolServer({}, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/tools/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          toolId: "knowledge_base",
          operation: "read_articles",
          parameters: { count: 3 },
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, "EXECUTED");
      assert.equal(body.data.decision, "ALLOW");
      assert.equal(body.data.execution.success, true);
    });
  });

  it("POST /api/v1/tools/execute: intercepts and blocks critical bulk delete", async () => {
    await withToolServer({}, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/tools/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          toolId: "customer_crm",
          operation: "delete_customers",
          parameters: { count: 147 },
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, "BLOCKED");
      assert.equal(body.data.decision, "BLOCK");
      assert.equal(body.data.executed, false);
      assert.equal(body.data.policy.policyCode, "bulk_delete_guard");
    });
  });

  it("POST /api/v1/tools/:id/test: dry-runs a tool directly", async () => {
    await withToolServer({}, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/tools/customer_crm/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_customer",
          parameters: { customerId: "cust_99" },
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.result.customer.id, "cust_99");
    });
  });
});
