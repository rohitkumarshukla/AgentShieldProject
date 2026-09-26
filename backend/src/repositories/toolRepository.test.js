import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createToolRepository, toToolRow } from "./toolRepository.js";
import { createMockSupabaseClient } from "./mockSupabaseClient.js";

describe("ToolRepository", () => {
  it("creates tools with mapped schema fields", async () => {
    const row = { id: "tool-1", name: "CRM.queryRecords", action_type: "read" };
    const client = createMockSupabaseClient({ data: row });
    const repo = createToolRepository(client);
    assert.deepEqual(await repo.createTool(row), row);
    assert.deepEqual(client.calls.inserts[0], row);
    assert.deepEqual(toToolRow({ ...row, private_field: "ignored" }), row);
  });

  it("lists tools and returns an empty list for non-array data", async () => {
    assert.deepEqual(await createToolRepository(createMockSupabaseClient({ data: [{ id: "t" }] })).listTools(), [{ id: "t" }]);
    assert.deepEqual(await createToolRepository(createMockSupabaseClient({ data: null })).listTools(), []);
  });

  it("gets tools by ID and name, returning null when missing", async () => {
    const found = createMockSupabaseClient({ data: { id: "t", name: "Email.send" } });
    const repo = createToolRepository(found);
    assert.equal((await repo.getToolById("t")).name, "Email.send");
    assert.equal((await repo.getToolByName("Email.send")).id, "t");
    assert.deepEqual(found.calls.eqFilters, [{ column: "id", value: "t" }, { column: "name", value: "Email.send" }]);
    const missing = createToolRepository(createMockSupabaseClient({ error: { code: "PGRST116", message: "no row" } }));
    assert.equal(await missing.getToolById("missing"), null);
  });

  it("propagates Supabase errors with their database code for service classification", async () => {
    const repo = createToolRepository(createMockSupabaseClient({ error: { code: "23505", message: "duplicate key" } }));
    await assert.rejects(() => repo.createTool({ name: "duplicate" }), (error) => error.code === "23505");
  });
});
