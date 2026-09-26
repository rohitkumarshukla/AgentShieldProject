import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  hashApiKey,
  extractApiKey,
  createAgentAuthMiddleware,
} from "./agentAuth.js";

function createMockResponse() {
  const res = {
    statusCode: null,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

describe("agentAuth Middleware", () => {
  describe("hashApiKey", () => {
    it("computes standard SHA-256 hex digest for non-empty string", () => {
      const rawKey = "ash_live_test123";
      const expected = crypto.createHash("sha256").update(rawKey).digest("hex");
      assert.equal(hashApiKey(rawKey), expected);
    });

    it("returns null for invalid or empty inputs", () => {
      assert.equal(hashApiKey(""), null);
      assert.equal(hashApiKey(null), null);
      assert.equal(hashApiKey(undefined), null);
      assert.equal(hashApiKey(12345), null);
    });
  });

  describe("extractApiKey", () => {
    it("extracts from 'x-agent-api-key' header", () => {
      const req = { headers: { "x-agent-api-key": "ash_live_secret_1" } };
      assert.equal(extractApiKey(req), "ash_live_secret_1");
    });

    it("extracts from 'x-api-key' header", () => {
      const req = { headers: { "x-api-key": "ash_live_secret_2" } };
      assert.equal(extractApiKey(req), "ash_live_secret_2");
    });

    it("extracts from 'Authorization: ApiKey <key>' header", () => {
      const req = { headers: { authorization: "ApiKey ash_live_secret_3" } };
      assert.equal(extractApiKey(req), "ash_live_secret_3");
    });

    it("extracts from 'Authorization: Bearer <key>' header", () => {
      const req = { headers: { authorization: "Bearer ash_live_secret_4" } };
      assert.equal(extractApiKey(req), "ash_live_secret_4");
    });

    it("returns null if header is missing or malformed", () => {
      assert.equal(extractApiKey({ headers: {} }), null);
      assert.equal(extractApiKey({ headers: { authorization: "Basic user:pass" } }), null);
      assert.equal(extractApiKey(null), null);
    });
  });

  describe("createAgentAuthMiddleware execution", () => {
    it("returns 500 when no Supabase client or repository is configured", async () => {
      const middleware = createAgentAuthMiddleware({ supabaseClient: null, agentRepository: null });
      const req = { headers: { "x-agent-api-key": "ash_live_123" } };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 500);
      assert.equal(res.jsonData.error.code, "AUTH_SERVICE_UNAVAILABLE");
    });

    it("returns 401 when API key header is missing", async () => {
      const mockRepo = {
        getAgentByApiKeyHash: async () => null,
      };
      const middleware = createAgentAuthMiddleware({ agentRepository: mockRepo });
      const req = { headers: {} };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.error.code, "UNAUTHORIZED");
      assert.match(res.jsonData.error.message, /Agent API key is missing/);
    });

    it("returns 401 when API key hash does not match any agent", async () => {
      const mockRepo = {
        getAgentByApiKeyHash: async () => null,
      };
      const middleware = createAgentAuthMiddleware({ agentRepository: mockRepo });
      const req = { headers: { "x-agent-api-key": "ash_live_unknown" } };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.error.code, "UNAUTHORIZED");
      assert.match(res.jsonData.error.message, /Invalid or unrecognized agent API key/);
    });

    it("returns 403 when agent exists but is inactive", async () => {
      const mockAgent = {
        id: "10000000-0000-0000-0000-000000000001",
        name: "Inactive Bot",
        status: "inactive",
        environment: "staging",
      };
      const mockRepo = {
        getAgentByApiKeyHash: async () => mockAgent,
      };
      const middleware = createAgentAuthMiddleware({ agentRepository: mockRepo });
      const req = { headers: { "x-agent-api-key": "ash_live_test" } };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.jsonData.error.code, "FORBIDDEN");
      assert.match(res.jsonData.error.message, /is inactive/);
    });

    it("authenticates active agent and attaches context to request", async () => {
      const mockAgent = {
        id: "10000000-0000-0000-0000-000000000001",
        name: "CRM Cleanup Agent",
        status: "active",
        environment: "production",
      };
      const mockRepo = {
        getAgentByApiKeyHash: async (hash) => {
          assert.equal(hash, hashApiKey("ash_live_valid_key"));
          return mockAgent;
        },
      };
      const middleware = createAgentAuthMiddleware({ agentRepository: mockRepo });
      const req = { headers: { "x-agent-api-key": "ash_live_valid_key" } };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.deepEqual(req.agent, mockAgent);
      assert.equal(req.agentId, "10000000-0000-0000-0000-000000000001");
      assert.equal(req.agentName, "CRM Cleanup Agent");
      assert.equal(req.agentEnvironment, "production");
    });

    it("returns 500 when database lookup throws an error", async () => {
      const mockRepo = {
        getAgentByApiKeyHash: async () => {
          throw new Error("Database timeout");
        },
      };
      const middleware = createAgentAuthMiddleware({ agentRepository: mockRepo });
      const req = { headers: { "x-agent-api-key": "ash_live_key" } };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 500);
      assert.equal(res.jsonData.error.code, "AUTH_VERIFICATION_FAILED");
    });
  });
});
