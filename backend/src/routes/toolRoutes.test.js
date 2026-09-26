import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import express from "express";
import { createToolRoutes } from "./toolRoutes.js";
import { createToolService, ToolServiceError } from "../services/toolService.js";
import { errorHandler } from "../middleware/errorHandler.js";

async function withServer(service, run) {
  const app = express(); app.use(express.json()); app.use("/api/v1", createToolRoutes({ toolService: service })); app.use(errorHandler);
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("tool routes create, list, get, and validate UUIDs", async () => {
  const row = { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "CRM.queryRecords", action_type: "read" };
  const service = createToolService({ async createTool() { return row; }, async listTools() { return [row]; }, async getToolById(id) { return id === row.id ? row : null; } });
  await withServer(service, async (url) => {
    let response = await fetch(`${url}/api/v1/tools`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: row.name, action_type: row.action_type }) });
    assert.equal(response.status, 201); assert.deepEqual((await response.json()).data.tool, row);
    response = await fetch(`${url}/api/v1/tools`); assert.deepEqual((await response.json()).data.tools, [row]);
    response = await fetch(`${url}/api/v1/tools/${row.id}`); assert.equal(response.status, 200);
    response = await fetch(`${url}/api/v1/tools/not-a-uuid`); assert.equal(response.status, 400);
    response = await fetch(`${url}/api/v1/tools/00000000-0000-0000-0000-000000000000`); assert.equal(response.status, 404);
  });
});

test("tool route maps conflicts and sanitizes unexpected failures", async () => {
  const duplicateService = { async create() { throw new ToolServiceError("Already registered", 409, "TOOL_CONFLICT"); } };
  await withServer(duplicateService, async (url) => {
    const response = await fetch(`${url}/api/v1/tools`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(response.status, 409); assert.equal((await response.json()).error.code, "TOOL_CONFLICT");
  });
  const brokenService = { async list() { throw new Error("raw SQL connection detail"); } };
  await withServer(brokenService, async (url) => {
    const response = await fetch(`${url}/api/v1/tools`); const text = await response.text();
    assert.equal(response.status, 500); assert.equal(text.includes("raw SQL connection detail"), false);
  });
});
