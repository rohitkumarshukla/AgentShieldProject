import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import express from "express";
import { createPermissionRoutes } from "./permissionRoutes.js";
import { PermissionServiceError } from "../services/permissionService.js";
import { errorHandler } from "../middleware/errorHandler.js";

async function withServer(service, run) {
  const app = express(); app.use(express.json()); app.use("/api/v1", createPermissionRoutes({ permissionService: service })); app.use(errorHandler);
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("permission routes create, list by agent, and delete grants", async () => {
  const grant = { id: "p1", agent_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", tool_id: "4ba85f64-5717-4562-b3fc-2c963f66afa7" };
  const service = {
    async create() { return grant; },
    async listByAgentId(id) { assert.equal(id, grant.agent_id); return [grant]; },
    async delete(id) { assert.equal(id, "p1"); return grant; },
  };
  await withServer(service, async (url) => {
    let response = await fetch(`${url}/api/v1/permissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(grant) });
    assert.equal(response.status, 201); assert.deepEqual((await response.json()).data.permission, grant);
    response = await fetch(`${url}/api/v1/permissions?agentId=${grant.agent_id}`); assert.deepEqual((await response.json()).data.permissions, [grant]);
    response = await fetch(`${url}/api/v1/permissions/p1`, { method: "DELETE" }); assert.equal(response.status, 200);
  });
});

test("permission routes return typed validation/conflict/not-found errors without database detail", async () => {
  const service = {
    async create() { throw new PermissionServiceError("Conflict", 409, "PERMISSION_CONFLICT"); },
    async listByAgentId() { throw new PermissionServiceError("agentId must be a valid UUID", 400); },
    async delete() { throw new PermissionServiceError("Permission not found", 404, "PERMISSION_NOT_FOUND"); },
  };
  await withServer(service, async (url) => {
    let response = await fetch(`${url}/api/v1/permissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(response.status, 409); assert.equal((await response.json()).error.code, "PERMISSION_CONFLICT");
    response = await fetch(`${url}/api/v1/permissions?agentId=bad`); assert.equal(response.status, 400);
    response = await fetch(`${url}/api/v1/permissions/nope`, { method: "DELETE" }); assert.equal(response.status, 404);
  });
  await withServer({ async create() { throw new Error("raw database statement"); } }, async (url) => {
    const response = await fetch(`${url}/api/v1/permissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    const text = await response.text(); assert.equal(response.status, 500); assert.equal(text.includes("raw database statement"), false);
  });
});
