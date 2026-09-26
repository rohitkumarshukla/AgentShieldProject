import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPermissionService } from "./permissionService.js";

const AGENT_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const TOOL_ID = "4ba85f64-5717-4562-b3fc-2c963f66afa7";
const GRANT = { id: "5ca85f64-5717-4562-b3fc-2c963f66afa8", agent_id: AGENT_ID, tool_id: TOOL_ID, max_scope: "bulk", environments: ["development"], api_key_hash: "never-return" };

function fixture(overrides = {}) {
  const calls = { created: null, lookup: [], deleted: null };
  const service = createPermissionService({
    agentRepository: { async getAgentById(id) { return id === AGENT_ID ? { id, status: "active" } : null; } },
    toolRepository: { async getToolById(id) { return id === TOOL_ID ? { id, name: "CRM.queryRecords", action_type: "read" } : null; } },
    permissionRepository: {
      async createPermission(input) { calls.created = input; return GRANT; },
      async listPermissionsByAgentId() { return [GRANT]; },
      async getPermissionById(id) { return id === GRANT.id ? GRANT : null; },
      async deletePermission(id) { calls.deleted = id; return id === GRANT.id ? GRANT : null; },
      async getPermissionForAgentAndTool(agentId, toolId) { calls.lookup.push({ agentId, toolId }); return overrides.permission === undefined ? GRANT : overrides.permission; },
      ...overrides.permissionRepository,
    },
  });
  return { service, calls };
}

describe("PermissionService", () => {
  it("creates validated permission after confirming agent and tool exist", async () => {
    const { service, calls } = fixture();
    const result = await service.create({ agent_id: AGENT_ID, tool_id: TOOL_ID, environments: ["development"], max_scope: "bulk" });
    assert.equal(result.id, GRANT.id);
    assert.equal(result.api_key_hash, undefined);
    assert.deepEqual(calls.created.environments, ["development"]);
  });

  it("rejects malformed IDs, unknown fields, and invalid optional constraint types", async () => {
    const { service } = fixture();
    for (const body of [
      { agent_id: "invalid", tool_id: TOOL_ID },
      { agent_id: AGENT_ID, tool_id: "invalid" },
      { agent_id: AGENT_ID, tool_id: TOOL_ID, extra: true },
      { agent_id: AGENT_ID, tool_id: TOOL_ID, environments: "development" },
      { agent_id: AGENT_ID, tool_id: TOOL_ID, environments: ["development", 1] },
      { agent_id: AGENT_ID, tool_id: TOOL_ID, max_scope: 1 },
      { agent_id: AGENT_ID, tool_id: TOOL_ID, granted_by: 5 },
    ]) await assert.rejects(() => service.create(body), (error) => error.statusCode === 400);
  });

  it("returns 404 when the referenced agent or tool does not exist", async () => {
    const { service } = fixture();
    await assert.rejects(() => service.create({ agent_id: "00000000-0000-0000-0000-000000000000", tool_id: TOOL_ID }), (error) => error.statusCode === 404 && error.code === "AGENT_NOT_FOUND");
    await assert.rejects(() => service.create({ agent_id: AGENT_ID, tool_id: "00000000-0000-0000-0000-000000000000" }), (error) => error.statusCode === 404 && error.code === "TOOL_NOT_FOUND");
  });

  it("maps duplicate grants to 409, lists by agent, and deletes existing grants", async () => {
    const { service, calls } = fixture({ permissionRepository: {
      async createPermission() { const error = new Error("duplicate"); error.code = "23505"; throw error; },
    } });
    await assert.rejects(() => service.create({ agent_id: AGENT_ID, tool_id: TOOL_ID }), (error) => error.statusCode === 409 && error.code === "PERMISSION_CONFLICT");
    assert.equal((await service.listByAgentId(AGENT_ID))[0].id, GRANT.id);
    assert.deepEqual(await service.delete(GRANT.id), { id: GRANT.id, agent_id: AGENT_ID, tool_id: TOOL_ID, max_scope: "bulk", environments: ["development"] });
    assert.equal(calls.deleted, GRANT.id);
    await assert.rejects(() => service.delete("missing"), (error) => error.statusCode === 400);
  });

  it("fails closed when no grant exists and enforces optional scope/environment bounds", async () => {
    const missing = fixture({ permission: null }).service;
    assert.deepEqual(await missing.checkAgentToolPermission(AGENT_ID, TOOL_ID), { allowed: false, permission: null });

    const { service } = fixture();
    assert.equal((await service.checkAgentToolPermission(AGENT_ID, TOOL_ID, { scope: { type: "single" }, environment: "development" })).allowed, true);
    assert.deepEqual(await service.checkAgentToolPermission(AGENT_ID, TOOL_ID, { actionType: "delete", scope: { type: "single" }, environment: "development" }), { allowed: false, permission: null });
    assert.deepEqual(await service.checkAgentToolPermission(AGENT_ID, TOOL_ID, { scope: { type: "all" }, environment: "development" }), { allowed: false, permission: null });
    assert.deepEqual(await service.checkAgentToolPermission(AGENT_ID, TOOL_ID, { scope: { type: "single" }, environment: "production" }), { allowed: false, permission: null });

    const noTool = createPermissionService({
      agentRepository: {},
      toolRepository: { async getToolById() { return null; } },
      permissionRepository: { async getPermissionForAgentAndTool() { throw new Error("lookup must not run for missing tool"); } },
    });
    assert.deepEqual(await noTool.checkAgentToolPermission(AGENT_ID, TOOL_ID), { allowed: false, permission: null });
  });
});
