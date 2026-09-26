import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPermissionRepository, toPermissionRow } from "./permissionRepository.js";
import { createMockSupabaseClient } from "./mockSupabaseClient.js";

const AGENT_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const TOOL_ID = "4ba85f64-5717-4562-b3fc-2c963f66afa7";

describe("PermissionRepository", () => {
  it("creates a permission and copies environment arrays", async () => {
    const input = { agent_id: AGENT_ID, tool_id: TOOL_ID, environments: ["development"] };
    const client = createMockSupabaseClient({ data: { id: "p1", ...input } });
    const result = await createPermissionRepository(client).createPermission(input);
    assert.equal(result.id, "p1");
    assert.deepEqual(client.calls.inserts[0], toPermissionRow(input));
    assert.notEqual(client.calls.inserts[0].environments, input.environments);
  });

  it("lists grants by agent and gets a permission by ID", async () => {
    const row = { id: "p1", agent_id: AGENT_ID, tool_id: TOOL_ID };
    const client = createMockSupabaseClient({ data: [row] });
    const repo = createPermissionRepository(client);
    assert.deepEqual(await repo.listPermissionsByAgentId(AGENT_ID), [row]);
    assert.deepEqual(client.calls.eqFilters[0], { column: "agent_id", value: AGENT_ID });
    const byId = createPermissionRepository(createMockSupabaseClient({ data: row }));
    assert.deepEqual(await byId.getPermissionById("p1"), row);
  });

  it("deletes a permission and returns null when the agent/tool grant is absent", async () => {
    const client = createMockSupabaseClient({ data: { id: "p1" } });
    const repo = createPermissionRepository(client);
    assert.deepEqual(await repo.deletePermission("p1"), { id: "p1" });
    assert.equal(client.calls.deletes, 1);
    const missing = createPermissionRepository(createMockSupabaseClient({ error: { code: "PGRST116", message: "no row" } }));
    assert.equal(await missing.getPermissionForAgentAndTool(AGENT_ID, TOOL_ID), null);
  });

  it("looks up grants by both IDs and propagates genuine database failures", async () => {
    const row = { id: "p1", agent_id: AGENT_ID, tool_id: TOOL_ID };
    const client = createMockSupabaseClient({ data: row });
    assert.deepEqual(await createPermissionRepository(client).getPermissionForAgentAndTool(AGENT_ID, TOOL_ID), row);
    assert.deepEqual(client.calls.eqFilters, [{ column: "agent_id", value: AGENT_ID }, { column: "tool_id", value: TOOL_ID }]);
    const failed = createPermissionRepository(createMockSupabaseClient({ error: { code: "XX000", message: "db failure" } }));
    await assert.rejects(() => failed.listPermissionsByAgentId(AGENT_ID), /Failed to list permissions/);
  });
});
