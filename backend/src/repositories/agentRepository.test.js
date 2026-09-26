import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAgentRepository, toAgentRow } from "./agentRepository.js";
import { createMockSupabaseClient } from "./mockSupabaseClient.js";

describe("AgentRepository", () => {
  it("fails fast if no valid Supabase client is provided", () => {
    assert.throws(
      () => createAgentRepository(null),
      /AgentRepository requires a valid Supabase client with a \.from\(\) method/
    );
    assert.throws(
      () => createAgentRepository({}),
      /AgentRepository requires a valid Supabase client with a \.from\(\) method/
    );
  });

  it("createAgent correctly inserts row into 'agents' table and returns created record", async () => {
    const mockRecord = {
      id: "agent-123",
      name: "SecurityScanner",
      description: "Automated vulnerability scanner",
      status: "active",
      environment: "production",
      metadata: { department: "SecOps" },
      created_at: "2026-09-26T12:00:00.000Z",
      updated_at: "2026-09-26T12:00:00.000Z",
    };

    const mockClient = createMockSupabaseClient({ data: mockRecord });
    const repo = createAgentRepository(mockClient);

    const input = {
      id: "agent-123",
      name: "SecurityScanner",
      description: "Automated vulnerability scanner",
      status: "active",
      environment: "production",
      metadata: { department: "SecOps" },
      createdAt: "2026-09-26T12:00:00.000Z",
      updatedAt: "2026-09-26T12:00:00.000Z",
    };

    const result = await repo.createAgent(input);

    assert.deepEqual(result, mockRecord);
    assert.equal(mockClient.calls.tables[0], "agents");
    assert.equal(mockClient.calls.inserts.length, 1);
    assert.equal(mockClient.calls.inserts[0].name, "SecurityScanner");
    assert.equal(mockClient.calls.inserts[0].created_at, "2026-09-26T12:00:00.000Z");
    assert.equal(mockClient.calls.inserts[0].updated_at, "2026-09-26T12:00:00.000Z");
  });

  it("createAgent does not mutate the caller input object", async () => {
    const mockClient = createMockSupabaseClient({ data: { id: "a-1" } });
    const repo = createAgentRepository(mockClient);

    const input = Object.freeze({
      name: "TestAgent",
      status: "active",
      metadata: Object.freeze({ role: "auditor" }),
    });

    const result = await repo.createAgent(input);
    assert.equal(result.id, "a-1");
  });

  it("createAgent throws when Supabase returns an error", async () => {
    const mockClient = createMockSupabaseClient({
      error: { message: "duplicate key value violates unique constraint", code: "23505" },
    });
    const repo = createAgentRepository(mockClient);

    await assert.rejects(
      () => repo.createAgent({ name: "DuplicateAgent" }),
      /Failed to create agent: duplicate key value violates unique constraint/
    );
  });

  it("getAgentById retrieves agent by primary key and returns null if not found (PGRST116)", async () => {
    // PostgREST PGRST116 is returned when 0 rows match .single()
    const notFoundClient = createMockSupabaseClient({
      error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
    });
    const repoNotFound = createAgentRepository(notFoundClient);

    const res = await repoNotFound.getAgentById("non-existent-uuid");
    assert.equal(res, null);
    assert.equal(notFoundClient.calls.tables[0], "agents");
    assert.deepEqual(notFoundClient.calls.eqFilters[0], { column: "id", value: "non-existent-uuid" });

    // Found case
    const foundRecord = { id: "agent-123", name: "AgentFound" };
    const foundClient = createMockSupabaseClient({ data: foundRecord });
    const repoFound = createAgentRepository(foundClient);

    const found = await repoFound.getAgentById("agent-123");
    assert.deepEqual(found, foundRecord);
  });

  it("getAgentById throws when an actual database error occurs", async () => {
    const errorClient = createMockSupabaseClient({
      error: { message: "connection refused", code: "57P03" },
    });
    const repo = createAgentRepository(errorClient);

    await assert.rejects(
      () => repo.getAgentById("agent-123"),
      /Failed to get agent: connection refused/
    );
  });

  it("listAgents returns array of records, or empty array if none exist", async () => {
    const listRecords = [
      { id: "a-1", name: "Agent 1" },
      { id: "a-2", name: "Agent 2" },
    ];
    const mockClient = createMockSupabaseClient({ data: listRecords });
    const repo = createAgentRepository(mockClient);

    const result = await repo.listAgents();
    assert.deepEqual(result, listRecords);

    // Empty list case
    const emptyClient = createMockSupabaseClient({ data: [] });
    const emptyRepo = createAgentRepository(emptyClient);

    const emptyResult = await emptyRepo.listAgents();
    assert.deepEqual(emptyResult, []);
  });

  it("listAgents throws when database query fails", async () => {
    const errorClient = createMockSupabaseClient({
      error: { message: "table does not exist" },
    });
    const repo = createAgentRepository(errorClient);

    await assert.rejects(
      () => repo.listAgents(),
      /Failed to list agents: table does not exist/
    );
  });

  it("updates an agent and replaces its API key hash", async () => {
    const client = createMockSupabaseClient({ data: { id: "agent-1", name: "Updated", api_key_hash: "new-hash" } });
    const repo = createAgentRepository(client);
    const updated = await repo.updateAgent("agent-1", { name: "Updated", updated_at: "now" });
    assert.equal(updated.name, "Updated");
    assert.deepEqual(client.calls.updates[0], { name: "Updated", updated_at: "now" });
    const keyUpdated = await repo.updateApiKeyHash("agent-1", "new-hash");
    assert.equal(keyUpdated.api_key_hash, "new-hash");
    assert.deepEqual(client.calls.updates[1], { api_key_hash: "new-hash" });
  });

  it("surfaces repository update failures for route-level sanitization", async () => {
    const repo = createAgentRepository(createMockSupabaseClient({ error: { code: "XX000", message: "internal detail" } }));
    await assert.rejects(() => repo.updateAgent("agent-1", { name: "Updated" }), /Failed to update agent: internal detail/);
    await assert.rejects(() => repo.updateApiKeyHash("agent-1", "hash"), /Failed to update agent API key: internal detail/);
  });

  it("getAgentByApiKeyHash retrieves agent by API key hash or returns null if not found", async () => {
    const mockRecord = { id: "agent-123", name: "CRMAgent", api_key_hash: "hash123" };
    const foundClient = createMockSupabaseClient({ data: mockRecord });
    const repoFound = createAgentRepository(foundClient);

    const found = await repoFound.getAgentByApiKeyHash("hash123");
    assert.deepEqual(found, mockRecord);
    assert.deepEqual(foundClient.calls.eqFilters[0], { column: "api_key_hash", value: "hash123" });

    // Not found case
    const notFoundClient = createMockSupabaseClient({
      error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
    });
    const repoNotFound = createAgentRepository(notFoundClient);
    const notFound = await repoNotFound.getAgentByApiKeyHash("unknown-hash");
    assert.equal(notFound, null);
  });
});
