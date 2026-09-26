import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import { createApprovalRoutes } from "./approvalRoutes.js";

async function withCustomServer(options, fn) {
  const customApp = express();
  customApp.use(express.json());
  customApp.use("/api/v1", createApprovalRoutes(options));

  const server = http.createServer(customApp);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://localhost:${server.address().port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("Approval Routes API", async (t) => {
  const pendingApproval = {
    id: "a0000000-0000-0000-0000-000000000001",
    action_id: "ac000000-0000-0000-0000-000000000001",
    status: "pending",
    reviewer: null,
    reason: null,
    created_at: new Date().toISOString(),
  };

  const fakeApprovalRepo = {
    items: [pendingApproval],
    async listApprovals({ status }) {
      const filtered = status ? this.items.filter((i) => i.status === status) : this.items;
      return { items: filtered, hasMore: false };
    },
    async getApprovalById(id) {
      return this.items.find((i) => i.id === id) || null;
    },
    async resolveApproval(id, { status, reviewer, reason }) {
      const item = this.items.find((i) => i.id === id);
      if (!item) throw new Error("Not found");
      item.status = status;
      item.reviewer = reviewer;
      item.reason = reason;
      item.resolved_at = new Date().toISOString();
      return item;
    },
  };

  await t.test("GET /api/v1/approvals: lists pending and resolved approvals", async () => {
    await withCustomServer({ approvalRepository: fakeApprovalRepo }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.approvals));
      assert.equal(body.data.approvals.length, 1);
    });
  });

  await t.test("GET /api/v1/approvals/:id: returns approval details", async () => {
    await withCustomServer({ approvalRepository: fakeApprovalRepo }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals/${pendingApproval.id}`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.approval.id, pendingApproval.id);
    });
  });

  await t.test("POST /api/v1/approvals/:id/approve: human authorizes and resolves action", async () => {
    await withCustomServer({ approvalRepository: fakeApprovalRepo }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals/${pendingApproval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer: "sec_operator@enterprise.com", notes: "Reviewed and verified" }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.approval.status, "approved");
      assert.equal(body.data.approval.reviewer, "sec_operator@enterprise.com");
    });
  });

  await t.test("POST /api/v1/approvals/:id/approve: returns 409 conflict when already resolved", async () => {
    await withCustomServer({ approvalRepository: fakeApprovalRepo }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals/${pendingApproval.id}/approve`, {
        method: "POST",
      });

      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.error.code, "APPROVAL_ALREADY_RESOLVED");
    });
  });

  await t.test("POST /api/v1/approvals/:id/reject: human denies paused action", async () => {
    const pendingToReject = {
      id: "a0000000-0000-0000-0000-000000000002",
      action_id: "ac000000-0000-0000-0000-000000000002",
      status: "pending",
      reviewer: null,
      reason: null,
      created_at: new Date().toISOString(),
    };
    fakeApprovalRepo.items.push(pendingToReject);

    await withCustomServer({ approvalRepository: fakeApprovalRepo }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals/${pendingToReject.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer: "sec_operator@enterprise.com", reason: "Potential security breach" }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.approval.status, "rejected");
      assert.equal(body.data.approval.reason, "Potential security breach");
    });
  });

  await t.test("GET /api/v1/approvals/:id: returns 400 for invalid UUID", async () => {
    await withCustomServer({ approvalRepository: fakeApprovalRepo }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals/invalid-uuid`);
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "INVALID_APPROVAL_ID");
    });
  });

  await t.test("GET /api/v1/approvals/:id: returns 404 for non-existent approval", async () => {
    await withCustomServer({ approvalRepository: fakeApprovalRepo }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals/00000000-0000-0000-0000-999999999999`);
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "APPROVAL_NOT_FOUND");
    });
  });

  await t.test("Offline mode returns 503 when repository unconfigured", async () => {
    await withCustomServer({ supabaseClient: null, approvalRepository: null }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/approvals`);
      assert.equal(res.status, 503);

      const body = await res.json();
      assert.equal(body.error.code, "SUPABASE_NOT_CONFIGURED");
    });
  });
});
