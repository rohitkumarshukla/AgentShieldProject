import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import {
  createAuditService,
  computeAuditIntegrityHash,
  AuditServiceError,
} from "./audit.service.js";

describe("Audit Service (Audit Management & Cryptographic Proof)", () => {
  const sampleAuditEvent = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    actionId: "e6f47738-94df-4155-9b7e-9086fa2530cb",
    agentId: "8f7d9832-680c-43cf-bc01-9c60662d512a",
    actionType: "read",
    target: "crm.customers",
    risk: { score: 15, level: "LOW", factors: [] },
    policy: {
      decision: "ALLOW",
      policyCode: "standard_risk_allow",
      reason: "Within risk tolerance",
      requiresHumanApproval: false,
    },
    status: "DECISION_MADE",
    createdAt: "2026-09-26T12:00:00.000Z",
    metadata: {},
  };

  const createMockRepo = () => {
    const store = new Map();
    store.set(sampleAuditEvent.id, {
      ...sampleAuditEvent,
      action_id: sampleAuditEvent.actionId,
      agent_id: sampleAuditEvent.agentId,
      action_type: sampleAuditEvent.actionType,
      risk_score: sampleAuditEvent.risk.score,
      risk_level: sampleAuditEvent.risk.level,
      policy_decision: sampleAuditEvent.policy.decision,
      policy_code: sampleAuditEvent.policy.policyCode,
      created_at: sampleAuditEvent.createdAt,
    });

    return {
      store,
      async createAuditEvent(event) {
        const id = event.id || "3fa85f64-5717-4562-b3fc-2c963f66afa6";
        const saved = { ...event, id };
        store.set(id, saved);
        return saved;
      },
      async getAuditEventById(id) {
        return store.get(id) || null;
      },
      async listAuditEvents({ agentId, decision, page = 1, limit = 20 } = {}) {
        let items = Array.from(store.values());
        if (agentId) items = items.filter((e) => (e.agent_id || e.agentId) === agentId);
        if (decision) items = items.filter((e) => (e.policy_decision || e.policy?.decision) === decision);
        const from = (page - 1) * limit;
        return { items: items.slice(from, from + limit), hasMore: items.length > from + limit, total: items.length };
      },
      async getAuditStats() {
        const items = Array.from(store.values());
        return {
          totalEvents: items.length,
          decisions: { allowed: items.length, blocked: 0, approvalRequired: 0 },
          riskDistribution: { critical: 0, high: 0, medium: 0, low: items.length },
          integrityStatus: "verified",
        };
      },
    };
  };

  it("computeAuditIntegrityHash generates consistent sha256 hash", () => {
    const hash1 = computeAuditIntegrityHash(sampleAuditEvent);
    const hash2 = computeAuditIntegrityHash(sampleAuditEvent);
    assert.equal(hash1, hash2);
    assert.ok(hash1.startsWith("sha256:"));
  });

  it("recordAuditEvent validates, enriches with hash, and persists", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    const result = await service.recordAuditEvent(sampleAuditEvent);
    assert.equal(result.id, sampleAuditEvent.id);
    assert.ok(result.integrityHash.startsWith("sha256:"));
  });

  it("recordAuditEvent throws validation error for invalid audit structure", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    await assert.rejects(
      () => service.recordAuditEvent({ id: "invalid" }),
      (err) => err instanceof AuditServiceError && err.code === "INVALID_AUDIT_EVENT"
    );
  });

  it("getAuditEventById retrieves event and provides cryptographic verification", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    const result = await service.getAuditEventById(sampleAuditEvent.id);
    assert.equal(result.audit.id, sampleAuditEvent.id);
    assert.equal(result.integrity.status, "sha256:integrity-verified ✓");
    assert.equal(result.integrity.verified, true);
  });

  it("getAuditEventById throws 400 for malformed UUID", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    await assert.rejects(
      () => service.getAuditEventById("bad-id"),
      (err) => err instanceof AuditServiceError && err.statusCode === 400
    );
  });

  it("getAuditEventById throws 404 when audit event is not found", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    await assert.rejects(
      () => service.getAuditEventById("00000000-0000-0000-0000-000000000000"),
      (err) => err instanceof AuditServiceError && err.statusCode === 404
    );
  });

  it("listAuditEvents returns paginated audit records with integrity proofs", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    const result = await service.listAuditEvents({ page: 1, limit: 10 });
    assert.ok(Array.isArray(result.auditEvents));
    assert.equal(result.auditEvents.length, 1);
    assert.ok(result.auditEvents[0].integrityProof.startsWith("sha256:"));
  });

  it("getAuditStats calculates governance analytics", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    const stats = await service.getAuditStats();
    assert.equal(stats.totalEvents, 1);
    assert.equal(stats.decisions.allowed, 1);
  });

  it("exportAuditLog exports JSON and CSV formats accurately", async () => {
    const repo = createMockRepo();
    const service = createAuditService({ auditEventRepository: repo });

    const jsonExport = await service.exportAuditLog({ format: "json" });
    assert.equal(jsonExport.contentType, "application/json");
    assert.ok(jsonExport.data.includes(sampleAuditEvent.id));

    const csvExport = await service.exportAuditLog({ format: "csv" });
    assert.equal(csvExport.contentType, "text/csv");
    assert.ok(csvExport.data.includes("ID,Action ID,Agent ID"));
    assert.ok(csvExport.data.includes(sampleAuditEvent.id));
  });
});
