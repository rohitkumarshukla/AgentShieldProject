import assert from "node:assert/strict";
import test from "node:test";

import { createAction } from "./action.js";
import { validateAction } from "./actionValidator.js";

test("TEST 1: Create a valid single read action", () => {
  try {
    const action = createAction({
      agentId: "agent-123",
      actionType: "read",
      target: "knowledge_base",
      description: "Read documentation articles",
      scope: { type: "single", count: 1 },
      destination: { type: "internal", value: "wiki" },
      environment: "development",
      sensitivity: { level: "internal" },
      financialImpact: 0,
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, true);
    assert.deepEqual(validation.errors, []);
    assert.ok(typeof action.id === "string" && action.id.length > 0, "generated id must exist");
    assert.ok(typeof action.createdAt === "string" && action.createdAt.length > 0, "createdAt must exist");
    assert.equal(action.actionType, "read");
    assert.equal(action.target, "knowledge_base");
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown by node:assert/strict when any test expectation fails (e.g. valid !== true).
    //
    // - TypeError:
    //   Thrown if createAction or validateAction receives illegal types or if method
    //   invocations on undefined/null references occur.
    //
    // - RangeError:
    //   Thrown if date generation (createdAt) or numerical constraints breach limits.
    //
    // - ReferenceError:
    //   Thrown if an unresolvable variable or module binding is referenced.
    //
    // - Error:
    //   Standard base exception for any unexpected runtime or test runner failures.
    // =========================================================================
    throw error;
  }
});

test("TEST 2: Create a valid bulk delete action", () => {
  try {
    const action = createAction({
      agentId: "demo-agent",
      actionType: "delete",
      target: "crm.customers",
      description: "Delete 147 CRM customers",
      scope: {
        type: "bulk",
        count: 147,
      },
      destination: {
        type: "internal",
        value: "crm",
      },
      environment: "production",
      sensitivity: {
        level: "sensitive",
      },
      financialImpact: 0,
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, true);
    assert.deepEqual(validation.errors, []);
    assert.equal(action.scope.count, 147);
    assert.equal(action.environment, "production");
    assert.equal(action.sensitivity.level, "sensitive");
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown by assert.* if validation state, scope count, or environment checks fail.
    //
    // - TypeError:
    //   Thrown if action properties or validation functions encounter type mismatches.
    //
    // - RangeError:
    //   Thrown if numeric scope limits or memory boundaries are exceeded.
    //
    // - Error:
    //   Catch-all standard error for unexpected execution failures.
    // =========================================================================
    throw error;
  }
});

test("TEST 3: Create a valid external send action", () => {
  try {
    const action = createAction({
      agentId: "agent-sales",
      actionType: "send",
      target: "crm.leads",
      description: "Send follow-up emails to 38 leads",
      scope: {
        type: "bulk",
        count: 38,
      },
      destination: {
        type: "external",
        value: "customer@example.com",
      },
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, true);
    assert.deepEqual(validation.errors, []);
    assert.equal(action.destination.type, "external");
    assert.equal(action.destination.value, "customer@example.com");
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if destination type or value assertion fails against expected strings.
    //
    // - TypeError:
    //   Thrown if string/destination access violates type contracts.
    //
    // - Error:
    //   Generic error fallback for unexpected test failures.
    // =========================================================================
    throw error;
  }
});

test("TEST 4: Reject missing agentId", () => {
  try {
    const action = createAction({
      actionType: "read",
      target: "crm.customers",
      description: "Read customer profile",
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, false);
    assert.ok(
      validation.errors.some((err) => err.includes("agentId")),
      "Errors should contain an agentId error",
    );
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if validation.valid is unexpectedly true or error list lacks agentId.
    //
    // - TypeError:
    //   Thrown if input creation or array operations fail due to invalid types.
    //
    // - Error:
    //   Generic runtime error fallback.
    // =========================================================================
    throw error;
  }
});

test("TEST 5: Reject unsupported actionType", () => {
  try {
    const action = createAction({
      agentId: "agent-123",
      actionType: "hack",
      target: "crm.customers",
      description: "Exploit vulnerability",
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, false);
    assert.ok(
      validation.errors.some((err) => err.includes("actionType")),
      "Errors should reject invalid actionType",
    );
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if unsupported actionType "hack" is erroneously marked valid.
    //
    // - TypeError:
    //   Thrown if unexpected type violations occur during validation.
    //
    // - Error:
    //   Generic runtime error fallback.
    // =========================================================================
    throw error;
  }
});

test("TEST 6: Reject negative scope count", () => {
  try {
    const action = createAction({
      agentId: "agent-123",
      actionType: "read",
      target: "crm.customers",
      description: "Read records",
      scope: { type: "bulk", count: -5 },
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, false);
    assert.ok(
      validation.errors.some((err) => err.includes("scope.count")),
      "Errors should reject negative scope.count",
    );
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if negative scope count check fails or errors array is missing expectation.
    //
    // - RangeError:
    //   Potential error if negative numeric ranges violate engine expectations.
    //
    // - TypeError:
    //   Thrown if scope.count type checking encounters an invalid type.
    //
    // - Error:
    //   Generic runtime error fallback.
    // =========================================================================
    throw error;
  }
});

test("TEST 7: Reject invalid environment", () => {
  try {
    const action = createAction({
      agentId: "agent-123",
      actionType: "read",
      target: "crm.customers",
      description: "Read records",
      environment: "sandbox_unknown",
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, false);
    assert.ok(
      validation.errors.some((err) => err.includes("environment")),
      "Errors should reject unsupported environment",
    );
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if unrecognized environment value is accepted instead of rejected.
    //
    // - TypeError:
    //   Thrown if environment string validation encounters a type violation.
    //
    // - Error:
    //   Generic runtime error fallback.
    // =========================================================================
    throw error;
  }
});

test("TEST 8: Reject negative financialImpact", () => {
  try {
    const action = createAction({
      agentId: "agent-123",
      actionType: "execute",
      target: "billing.charge",
      description: "Issue transaction",
      financialImpact: -100,
    });

    const validation = validateAction(action);

    assert.equal(validation.valid, false);
    assert.ok(
      validation.errors.some((err) => err.includes("financialImpact")),
      "Errors should reject negative financialImpact",
    );
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if negative financial impact passes validation unexpectedly.
    //
    // - RangeError:
    //   Potential numerical range violation if financial limits are breached.
    //
    // - TypeError:
    //   Thrown if financialImpact type verification fails.
    //
    // - Error:
    //   Generic runtime error fallback.
    // =========================================================================
    throw error;
  }
});

test("TEST 9: Reject null input and throw TypeError", () => {
  try {
    let caughtError = null;
    try {
      createAction(null);
    } catch (err) {
      caughtError = err;
      // =======================================================================
      // Error Type Details (Caught Exception Inspection):
      //
      // - TypeError:
      //   Expected error type when 'input' is null. Plain objects are required.
      //
      // - Error:
      //   Base class of TypeError, verifying error prototype inheritance.
      // =======================================================================
      assert.ok(err instanceof TypeError, "Expected err to be an instance of TypeError");
      assert.match(err.message, /'input' must be a valid non-null object/);
    }

    assert.ok(caughtError !== null, "createAction(null) must throw a TypeError");
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if no TypeError was caught or assertion conditions fail.
    //
    // - Error:
    //   Catch-all standard error for test execution.
    // =========================================================================
    throw error;
  }
});

test("TEST 10: Reject non-object primitive inputs and throw TypeError", () => {
  try {
    const invalidInputs = [42, "invalid-string", true, Symbol("action")];

    for (const invalidInput of invalidInputs) {
      let caughtError = null;
      try {
        createAction(invalidInput);
      } catch (err) {
        caughtError = err;
        // =====================================================================
        // Error Type Details (Caught Exception Inspection):
        //
        // - TypeError:
        //   Expected error type when passing primitive values to createAction.
        // =====================================================================
        assert.ok(
          err instanceof TypeError,
          `Expected input ${String(invalidInput)} to throw TypeError`,
        );
      }
      assert.ok(caughtError !== null, `createAction(${String(invalidInput)}) must throw`);
    }
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if any primitive fails to trigger a TypeError.
    //
    // - Error:
    //   Generic runtime error fallback.
    // =========================================================================
    throw error;
  }
});

test("TEST 11: Reject array input and throw TypeError", () => {
  try {
    let caughtError = null;
    try {
      createAction([]);
    } catch (err) {
      caughtError = err;
      // =======================================================================
      // Error Type Details (Caught Exception Inspection):
      //
      // - TypeError:
      //   Arrays are object types in JS, but are invalid action specification maps.
      // =======================================================================
      assert.ok(err instanceof TypeError, "Expected array input to throw TypeError");
    }

    assert.ok(caughtError !== null, "createAction([]) must throw a TypeError");
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - AssertionError:
    //   Thrown if array input doesn't trigger TypeError or test invariants fail.
    //
    // - Error:
    //   Generic runtime error fallback.
    // =========================================================================
    throw error;
  }
});
