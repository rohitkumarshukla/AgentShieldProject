import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createActionRepository, toActionRow } from "./actionRepository.js";
import { createMockSupabaseClient } from "./mockSupabaseClient.js";

describe("ActionRepository", () => {
  it("fails fast if no valid Supabase client is provided", () => {
    assert.throws(
      () => createActionRepository(null),
      /ActionRepository requires a valid Supabase client with a \.from\(\) method/
    );
    assert.throws(
      () => createActionRepository({}),
      /ActionRepository requires a valid Supabase client with a \.from\(\) method/
    );
  });

  it("createAction correctly maps application action to database columns and inserts into 'actions'", async () => {
    const mockRecord = {
      id: "act-123",
      agent_id: "agent-999",
      action_type: "delete",
      target: "users_table",
      description: "Purge inactive users",
      scope: { type: "bulk", count: 147 },
      destination: { type: "none", value: null },
      environment: "production",
      sensitivity: { level: "restricted" },
      financial_impact: 5000,
      metadata: { initiatedBy: "cron" },
      created_at: "2026-09-26T12:00:00.000Z",
    };

    const mockClient = createMockSupabaseClient({ data: mockRecord });
    const repo = createActionRepository(mockClient);

    const inputAction = {
      id: "act-123",
      agentId: "agent-999",
      actionType: "delete",
      target: "users_table",
      description: "Purge inactive users",
      scope: { type: "bulk", count: 147 },
      destination: { type: "none", value: null },
      environment: "production",
      sensitivity: { level: "restricted" },
      financialImpact: 5000,
      metadata: { initiatedBy: "cron" },
      createdAt: "2026-09-26T12:00:00.000Z",
    };

    const result = await repo.createAction(inputAction);

    assert.deepEqual(result, mockRecord);
    assert.equal(mockClient.calls.tables[0], "actions");
    assert.equal(mockClient.calls.inserts.length, 1);

    const inserted = mockClient.calls.inserts[0];
    assert.equal(inserted.agent_id, "agent-999");
    assert.equal(inserted.action_type, "delete");
    assert.equal(inserted.financial_impact, 5000);
    assert.deepEqual(inserted.scope, { type: "bulk", count: 147 });
    assert.deepEqual(inserted.sensitivity, { level: "restricted" });
    assert.equal(inserted.created_at, "2026-09-26T12:00:00.000Z");
  });

  it("createAction preserves nested JSON objects without mutating caller input", async () => {
    const mockClient = createMockSupabaseClient({ data: { id: "act-1" } });
    const repo = createActionRepository(mockClient);

    const input = Object.freeze({
      agentId: "a1",
      actionType: "send",
      scope: Object.freeze({ type: "single", count: 1 }),
      sensitivity: Object.freeze({ level: "public" }),
    });

    const result = await repo.createAction(input);
    assert.equal(result.id, "act-1");
  });

  it("createAction throws when Supabase returns an error", async () => {
    const mockClient = createMockSupabaseClient({
      error: { message: "violates foreign key constraint fk_actions_agent", code: "23503" },
    });
    const repo = createActionRepository(mockClient);

    await assert.rejects(
      () => repo.createAction({ agentId: "non-existent-agent" }),
      /Failed to create action: violates foreign key constraint fk_actions_agent/
    );
  });

  it("getActionById retrieves action and returns null when not found", async () => {
    const notFoundClient = createMockSupabaseClient({
      error: { message: "no rows", code: "PGRST116" },
    });
    const repo = createActionRepository(notFoundClient);

    const result = await repo.getActionById("act-missing");
    assert.equal(result, null);
    assert.equal(notFoundClient.calls.tables[0], "actions");
    assert.deepEqual(notFoundClient.calls.eqFilters[0], { column: "id", value: "act-missing" });
  });

  it("listActionsByAgentId filters by agent_id and returns rows", async () => {
    const rows = [
      { id: "act-1", agent_id: "agent-100", action_type: "read" },
      { id: "act-2", agent_id: "agent-100", action_type: "write" },
    ];
    const mockClient = createMockSupabaseClient({ data: rows });
    const repo = createActionRepository(mockClient);

    const result = await repo.listActionsByAgentId("agent-100");
    assert.deepEqual(result, rows);
    assert.equal(mockClient.calls.tables[0], "actions");
    assert.deepEqual(mockClient.calls.eqFilters[0], { column: "agent_id", value: "agent-100" });
  });

  it("listActionsByAgentId validates agentId argument", async () => {
    const repo = createActionRepository(createMockSupabaseClient());
    await assert.rejects(
      () => repo.listActionsByAgentId(""),
      /Failed to list actions by agent: valid agentId is required/
    );
    await assert.rejects(
      () => repo.listActionsByAgentId(null),
      /Failed to list actions by agent: valid agentId is required/
    );
  });
});
