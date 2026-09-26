import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAuditEventRepository, toAuditEventRow } from "./auditEventRepository.js";
import { createMockSupabaseClient } from "./mockSupabaseClient.js";

describe("AuditEventRepository", () => {
  it("fails fast if no valid Supabase client is provided", () => {
    assert.throws(
      () => createAuditEventRepository(null),
      /AuditEventRepository requires a valid Supabase client with a \.from\(\) method/
    );
    assert.throws(
      () => createAuditEventRepository({}),
      /AuditEventRepository requires a valid Supabase client with a \.from\(\) method/
    );
  });

  it("createAuditEvent flattens risk and policy fields into individual queryable columns", async () => {
    const mockRecord = {
      id: "aud-900",
      action_id: "act-555",
      agent_id: "agent-123",
      action_type: "delete",
      target: "users_table",
      risk_score: 100,
      risk_level: "CRITICAL",
      risk_factors: [{ code: "bulk_delete", description: "Bulk delete guard", points: 85 }],
      policy_decision: "BLOCK",
      policy_code: "bulk_delete_guard",
      policy_reason: "Bulk deletion of 147 records exceeds safe limit",
      requires_human_approval: false,
      status: "BLOCKED",
      metadata: { source: "test" },
      created_at: "2026-09-26T12:00:00.000Z",
    };

    const mockClient = createMockSupabaseClient({ data: mockRecord });
    const repo = createAuditEventRepository(mockClient);

    const inputEvent = {
      id: "aud-900",
      actionId: "act-555",
      agentId: "agent-123",
      actionType: "delete",
      target: "users_table",
      risk: {
        score: 100,
        level: "CRITICAL",
        factors: [{ code: "bulk_delete", description: "Bulk delete guard", points: 85 }],
      },
      policy: {
        decision: "BLOCK",
        policyCode: "bulk_delete_guard",
        reason: "Bulk deletion of 147 records exceeds safe limit",
        requiresHumanApproval: false,
      },
      status: "BLOCKED",
      metadata: { source: "test" },
      createdAt: "2026-09-26T12:00:00.000Z",
    };

    const result = await repo.createAuditEvent(inputEvent);

    assert.deepEqual(result, mockRecord);
    assert.equal(mockClient.calls.tables[0], "audit_events");
    assert.equal(mockClient.calls.inserts.length, 1);

    const inserted = mockClient.calls.inserts[0];
    assert.equal(inserted.action_id, "act-555");
    assert.equal(inserted.agent_id, "agent-123");
    assert.equal(inserted.action_type, "delete");
    assert.equal(inserted.target, "users_table");
    assert.equal(inserted.risk_score, 100);
    assert.equal(inserted.risk_level, "CRITICAL");
    assert.deepEqual(inserted.risk_factors, [{ code: "bulk_delete", description: "Bulk delete guard", points: 85 }]);
    assert.equal(inserted.policy_decision, "BLOCK");
    assert.equal(inserted.policy_code, "bulk_delete_guard");
    assert.equal(inserted.policy_reason, "Bulk deletion of 147 records exceeds safe limit");
    assert.equal(inserted.requires_human_approval, false);
    assert.equal(inserted.status, "BLOCKED");
    assert.equal(inserted.created_at, "2026-09-26T12:00:00.000Z");
  });

  it("createAuditEvent preserves caller input immutability", async () => {
    const mockClient = createMockSupabaseClient({ data: { id: "aud-1" } });
    const repo = createAuditEventRepository(mockClient);

    const input = Object.freeze({
      actionId: "a1",
      agentId: "ag1",
      actionType: "send",
      target: "external-api",
      risk: Object.freeze({ score: 10, level: "LOW", factors: Object.freeze([]) }),
      policy: Object.freeze({ decision: "ALLOW", policyCode: "p1", reason: "ok", requiresHumanApproval: false }),
      status: "DECISION_MADE",
    });

    const result = await repo.createAuditEvent(input);
    assert.equal(result.id, "aud-1");
  });

  it("createAuditEvent throws when Supabase returns an error", async () => {
    const mockClient = createMockSupabaseClient({
      error: { message: "violates check constraint chk_audit_events_status", code: "23514" },
    });
    const repo = createAuditEventRepository(mockClient);

    await assert.rejects(
      () => repo.createAuditEvent({ status: "INVALID_STATUS" }),
      /Failed to create audit event: violates check constraint chk_audit_events_status/
    );
  });

  it("getAuditEventById retrieves record or returns null", async () => {
    const notFoundClient = createMockSupabaseClient({
      error: { message: "no rows", code: "PGRST116" },
    });
    const repo = createAuditEventRepository(notFoundClient);

    const result = await repo.getAuditEventById("aud-missing");
    assert.equal(result, null);
    assert.equal(notFoundClient.calls.tables[0], "audit_events");
    assert.deepEqual(notFoundClient.calls.eqFilters[0], { column: "id", value: "aud-missing" });
  });

  it("listAuditEventsByActionId filters by action_id and returns rows", async () => {
    const rows = [
      { id: "aud-1", action_id: "act-1", status: "DECISION_MADE" },
    ];
    const mockClient = createMockSupabaseClient({ data: rows });
    const repo = createAuditEventRepository(mockClient);

    const result = await repo.listAuditEventsByActionId("act-1");
    assert.deepEqual(result, rows);
    assert.equal(mockClient.calls.tables[0], "audit_events");
    assert.deepEqual(mockClient.calls.eqFilters[0], { column: "action_id", value: "act-1" });
  });

  it("listAuditEventsByAgentId filters by agent_id and returns rows", async () => {
    const rows = [
      { id: "aud-1", agent_id: "agent-1", status: "DECISION_MADE" },
      { id: "aud-2", agent_id: "agent-1", status: "AWAITING_APPROVAL" },
    ];
    const mockClient = createMockSupabaseClient({ data: rows });
    const repo = createAuditEventRepository(mockClient);

    const result = await repo.listAuditEventsByAgentId("agent-1");
    assert.deepEqual(result, rows);
    assert.equal(mockClient.calls.tables[0], "audit_events");
    assert.deepEqual(mockClient.calls.eqFilters[0], { column: "agent_id", value: "agent-1" });
  });

  it("validates id arguments in getter/filter methods", async () => {
    const repo = createAuditEventRepository(createMockSupabaseClient());

    await assert.rejects(
      () => repo.getAuditEventById(""),
      /Failed to get audit event: valid id is required/
    );
    await assert.rejects(
      () => repo.listAuditEventsByActionId(null),
      /Failed to list audit events by action: valid actionId is required/
    );
    await assert.rejects(
      () => repo.listAuditEventsByAgentId(undefined),
      /Failed to list audit events by agent: valid agentId is required/
    );
  });
});
