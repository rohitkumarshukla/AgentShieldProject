import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePaginationParams, validatePaginationMiddleware } from "./pagination.js";

test("parsePaginationParams: returns default page=1, limit=20 when query is empty or undefined", () => {
  assert.deepEqual(parsePaginationParams(), { valid: true, page: 1, limit: 20 });
  assert.deepEqual(parsePaginationParams({}), { valid: true, page: 1, limit: 20 });
});

test("parsePaginationParams: parses valid page and limit integers", () => {
  const result = parsePaginationParams({ page: "3", limit: "50" });
  assert.deepEqual(result, { valid: true, page: 3, limit: 50 });
});

test("parsePaginationParams: accepts numbers directly if already coerced", () => {
  const result = parsePaginationParams({ page: 2, limit: 10 });
  assert.deepEqual(result, { valid: true, page: 2, limit: 10 });
});

test("parsePaginationParams: accepts boundary limit values 1 and 100", () => {
  assert.deepEqual(parsePaginationParams({ page: "1", limit: "1" }), { valid: true, page: 1, limit: 1 });
  assert.deepEqual(parsePaginationParams({ page: "1", limit: "100" }), { valid: true, page: 1, limit: 100 });
});

test("parsePaginationParams: rejects non-numeric or malformed page", () => {
  const cases = ["abc", "-1", "0", "1.5", "1e2", "null", "NaN", "true", "  "];
  for (const invalidPage of cases) {
    const res = parsePaginationParams({ page: invalidPage });
    assert.equal(res.valid, false, `Expected invalid for page="${invalidPage}"`);
    assert.match(res.error, /Invalid page parameter/);
  }
});

test("parsePaginationParams: rejects non-numeric, 0, negative, float, or limit > 100", () => {
  const cases = ["abc", "-5", "0", "2.5", "101", "200", "null", "NaN"];
  for (const invalidLimit of cases) {
    const res = parsePaginationParams({ limit: invalidLimit });
    assert.equal(res.valid, false, `Expected invalid for limit="${invalidLimit}"`);
    assert.match(res.error, /Invalid limit parameter/);
  }
});

test("validatePaginationMiddleware: sets req.pagination on valid input and calls next", () => {
  let calledNext = false;
  const req = { query: { page: "2", limit: "15" } };
  const res = {};
  const next = () => { calledNext = true; };

  validatePaginationMiddleware(req, res, next);
  assert.equal(calledNext, true);
  assert.deepEqual(req.pagination, { page: 2, limit: 15 });
});

test("validatePaginationMiddleware: responds with 400 INVALID_PAGINATION on invalid parameter", () => {
  let statusSet = null;
  let jsonSent = null;

  const req = { query: { page: "-1" } };
  const res = {
    status(code) {
      statusSet = code;
      return this;
    },
    json(payload) {
      jsonSent = payload;
      return this;
    },
  };
  let calledNext = false;
  const next = () => { calledNext = true; };

  validatePaginationMiddleware(req, res, next);
  assert.equal(calledNext, false);
  assert.equal(statusSet, 400);
  assert.equal(jsonSent.success, false);
  assert.equal(jsonSent.error.code, "INVALID_PAGINATION");
});
