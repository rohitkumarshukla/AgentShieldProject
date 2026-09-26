import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUserAuthMiddleware, extractBearerToken } from "./userAuth.js";

describe("userAuth middleware", () => {
  it("extractBearerToken correctly parses valid Bearer tokens", () => {
    assert.equal(
      extractBearerToken({ headers: { authorization: "Bearer eyJhbGciOi..." } }),
      "eyJhbGciOi..."
    );
    assert.equal(
      extractBearerToken({ headers: { authorization: "bearer  token123  " } }),
      "token123"
    );
  });

  it("extractBearerToken returns null for missing or invalid header formats", () => {
    assert.equal(extractBearerToken(null), null);
    assert.equal(extractBearerToken({}), null);
    assert.equal(extractBearerToken({ headers: {} }), null);
    assert.equal(extractBearerToken({ headers: { authorization: "Basic dXNlcjpwYXNz" } }), null);
    assert.equal(extractBearerToken({ headers: { authorization: "Bearer" } }), null);
  });

  it("returns 500 AUTH_SERVICE_UNAVAILABLE if Supabase client is not configured", async () => {
    const middleware = createUserAuthMiddleware({ supabaseClient: null });

    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    const req = { headers: { authorization: "Bearer valid-token" } };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, res, next);

    assert.equal(statusCode, 500);
    assert.equal(responseBody.error.code, "AUTH_SERVICE_UNAVAILABLE");
    assert.equal(nextCalled, false);
  });

  it("returns 401 UNAUTHORIZED if Authorization header is missing", async () => {
    const mockSupabase = {
      auth: {
        getUser: async () => ({ data: null, error: null }),
      },
    };
    const middleware = createUserAuthMiddleware({ supabaseClient: mockSupabase });

    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    const req = { headers: {} };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, res, next);

    assert.equal(statusCode, 401);
    assert.equal(responseBody.error.code, "UNAUTHORIZED");
    assert.match(responseBody.error.message, /missing or malformed/i);
    assert.equal(nextCalled, false);
  });

  it("returns 401 UNAUTHORIZED if Supabase rejects the token", async () => {
    const mockSupabase = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: "Invalid token signature" },
        }),
      },
    };
    const middleware = createUserAuthMiddleware({ supabaseClient: mockSupabase });

    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    const req = { headers: { authorization: "Bearer invalid.jwt.token" } };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, res, next);

    assert.equal(statusCode, 401);
    assert.equal(responseBody.error.code, "UNAUTHORIZED");
    assert.equal(responseBody.error.message, "Invalid token signature");
    assert.equal(nextCalled, false);
  });

  it("calls next() and attaches user details to req when token is valid", async () => {
    const mockUser = {
      id: "usr_12345",
      email: "admin@agentshield.internal",
      role: "authenticated",
      app_metadata: { role: "security_admin" },
    };

    const mockSupabase = {
      auth: {
        getUser: async (token) => {
          assert.equal(token, "good-token-123");
          return { data: { user: mockUser }, error: null };
        },
      },
    };

    const middleware = createUserAuthMiddleware({ supabaseClient: mockSupabase });

    const req = { headers: { authorization: "Bearer good-token-123" } };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, {}, next);

    assert.equal(nextCalled, true);
    assert.equal(req.user, mockUser);
    assert.equal(req.userId, "usr_12345");
    assert.equal(req.userEmail, "admin@agentshield.internal");
    assert.equal(req.userRole, "security_admin");
  });
});
