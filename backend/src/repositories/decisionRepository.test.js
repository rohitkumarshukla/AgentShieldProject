import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDecisionRepository, toDecisionRow } from "./decisionRepository.js";
import { createMockSupabaseClient } from "./mockSupabaseClient.js";

describe("DecisionRepository", () => {
  it("fails fast if no valid Supabase client is provided", () => {
    assert.throws(
      () => createDecisionRepository(null),
      /DecisionRepository requires a valid Supabase client with a \.from\(\) method/
    );
    assert.throws(
      () => createDecisionRepository({}),
      /DecisionRepository requires a valid Supabase client with a \.from\(\) method/
    );
  });

  it("createDecision flattens application decision structure into normalized database columns", async () => {
    const mockRecord = {
      id: "dec-100",
      action_id: "act-555",
      risk_score: 85,
      risk_level: "CRITICAL",
      risk_factors: [{ code: "bulk_delete", description: "Bulk delete guard", points: 85 }],
      policy_decision: "BLOCK",
      policy_code: "bulk_delete_guard",
      policy_reason: "Bulk deletion of 147 records exceeds safe limit",
      requires_human_approval: false,
      metadata: { evaluatedBy: "DecisionEngine" },
      created_at: "2026-09-26T12:00:00.000Z",
    };

    const mockClient = createMockSupabaseClient({ data: mockRecord });
    const repo = createDecisionRepository(mockClient);

    const inputDecision = {
      id: "dec-100",
      action: { id: "act-555" },
      risk: {
        score: 85,
        level: "CRITICAL",
        factors: [{ code: "bulk_delete", description: "Bulk delete guard", points: 85 }],
      },
      policy: {
        decision: "BLOCK",
        policyCode: "bulk_delete_guard",
        reason: "Bulk deletion of 147 records exceeds safe limit",
        requiresHumanApproval: false,
      },
      metadata: { evaluatedBy: "DecisionEngine" },
      createdAt: "2026-09-26T12:00:00.000Z",
    };

    const result = await repo.createDecision(inputDecision);

    assert.deepEqual(result, mockRecord);
    assert.equal(mockClient.calls.tables[0], "decisions");
    assert.equal(mockClient.calls.inserts.length, 1);

    const inserted = mockClient.calls.inserts[0];
    assert.equal(inserted.action_id, "act-555");
    assert.equal(inserted.risk_score, 85);
    assert.equal(inserted.risk_level, "CRITICAL");
    assert.deepEqual(inserted.risk_factors, [{ code: "bulk_delete", description: "Bulk delete guard", points: 85 }]);
    assert.equal(inserted.policy_decision, "BLOCK");
    assert.equal(inserted.policy_code, "bulk_delete_guard");
    assert.equal(inserted.policy_reason, "Bulk deletion of 147 records exceeds safe limit");
    assert.equal(inserted.requires_human_approval, false);
    assert.equal(inserted.created_at, "2026-09-26T12:00:00.000Z");

    // Explicitly verify old column names are NOT present in inserted row
    assert.equal("decision" in inserted, false);
    assert.equal("reason" in inserted, false);
  });

  it("createDecision does not mutate caller input object or its nested structures", async () => {
    const mockClient = createMockSupabaseClient({ data: { id: "dec-1" } });
    const repo = createDecisionRepository(mockClient);

    const input = Object.freeze({
      action: Object.freeze({ id: "act-1" }),
      risk: Object.freeze({
        score: 10,
        level: "LOW",
        factors: Object.freeze([{ code: "f1", description: "f", points: 10 }]),
      }),
      policy: Object.freeze({
        decision: "ALLOW",
        policyCode: "std",
        reason: "safe",
        requiresHumanApproval: false,
      }),
    });

    const result = await repo.createDecision(input);
    assert.equal(result.id, "dec-1");
  });

  it("createDecision throws when Supabase returns an error", async () => {
    const mockClient = createMockSupabaseClient({
      error: { message: "duplicate key value violates unique constraint uq_decisions_action_id", code: "23505" },
    });
    const repo = createDecisionRepository(mockClient);

    await assert.rejects(
      () => repo.createDecision({ action: { id: "act-exists" } }),
      /Failed to create decision: duplicate key value violates unique constraint uq_decisions_action_id/
    );
  });

  it("getDecisionById retrieves decision by id or returns null", async () => {
    const notFoundClient = createMockSupabaseClient({
      error: { message: "no rows", code: "PGRST116" },
    });
    const repo = createDecisionRepository(notFoundClient);

    const result = await repo.getDecisionById("dec-missing");
    assert.equal(result, null);
    assert.equal(notFoundClient.calls.tables[0], "decisions");
    assert.deepEqual(notFoundClient.calls.eqFilters[0], { column: "id", value: "dec-missing" });
  });

  it("getDecisionByActionId retrieves decision by action_id or returns null", async () => {
    const foundRecord = { id: "dec-1", action_id: "act-1", policy_decision: "ALLOW" };
    const mockClient = createMockSupabaseClient({ data: foundRecord });
    const repo = createDecisionRepository(mockClient);

    const result = await repo.getDecisionByActionId("act-1");
    assert.deepEqual(result, foundRecord);
    assert.equal(mockClient.calls.tables[0], "decisions");
    assert.deepEqual(mockClient.calls.eqFilters[0], { column: "action_id", value: "act-1" });
  });
});
