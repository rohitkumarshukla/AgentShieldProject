import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notFoundHandler } from "./notFound.js";
import { ApiError } from "../utils/ApiError.js";

describe("notFoundHandler Middleware", () => {
  it("forwards a 404 ApiError with NOT_FOUND code to next()", (t, done) => {
    const req = { method: "GET", originalUrl: "/api/v1/unknown" };
    const res = {};

    notFoundHandler(req, res, (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, "NOT_FOUND");
      assert.equal(err.message, "Route GET /api/v1/unknown not found");
      done();
    });
  });
});
