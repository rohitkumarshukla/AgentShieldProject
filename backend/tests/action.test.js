import test from "node:test";
import assert from "node:assert/strict";
import { createAction } from "../src/domain/action.js";

test("createAction - creates normalized action with full valid payload", () => {
  const input = {
    agentId: "agent-123",
    toolId: "bash_executor",
    operation: "exec",
    parameters: { command: "ls -la" },
    environment: "staging",
    userPrompt: "List all directory contents",
  };

  const action = createAction(input);

  assert.deepEqual(action, {
    agentId: "agent-123",
    toolId: "bash_executor",
    operation: "exec",
    parameters: { command: "ls -la" },
    environment: "staging",
    userPrompt: "List all directory contents",
  });
});

test("createAction - applies documented defaults when optional fields are omitted", () => {
  const input = {
    agentId: "agent-default",
    toolId: "web_search",
    operation: "query",
  };

  const action = createAction(input);

  assert.deepEqual(action, {
    agentId: "agent-default",
    toolId: "web_search",
    operation: "query",
    parameters: {},
    environment: "development",
    userPrompt: "",
  });
});

test("createAction - trims surrounding whitespace from required string fields", () => {
  const input = {
    agentId: "   agent-with-spaces   ",
    toolId: "\t tool-with-tabs \t",
    operation: "  operation-with-spaces  \n",
    parameters: { key: "value" },
    environment: "production",
    userPrompt: "  preserve whitespace in prompt if intentional  ",
  };

  const action = createAction(input);

  assert.equal(action.agentId, "agent-with-spaces");
  assert.equal(action.toolId, "tool-with-tabs");
  assert.equal(action.operation, "operation-with-spaces");
  // userPrompt should not have required string trimming applied
  assert.equal(action.userPrompt, "  preserve whitespace in prompt if intentional  ");
});

test("createAction - returns only defined action fields and strips extra fields", () => {
  const input = {
    agentId: "agent-1",
    toolId: "tool-1",
    operation: "run",
    extraProperty: "malicious_or_unknown",
    id: "should_not_override",
    timestamp: 123456789,
    nested: { danger: true },
  };

  const action = createAction(input);

  const expectedKeys = ["agentId", "toolId", "operation", "parameters", "environment", "userPrompt"].sort();
  const actualKeys = Object.keys(action).sort();

  assert.deepEqual(actualKeys, expectedKeys);
  assert.equal("extraProperty" in action, false);
  assert.equal("id" in action, false);
  assert.equal("timestamp" in action, false);
});

test("createAction - does not auto-generate ids, timestamps, or random fields", () => {
  const input = {
    agentId: "agent-1",
    toolId: "tool-1",
    operation: "run",
  };

  const action = createAction(input);

  assert.equal(action.id, undefined);
  assert.equal(action.timestamp, undefined);
  assert.equal(action.uuid, undefined);
  assert.equal(action.createdAt, undefined);
});

test("createAction - creates an isolated parameters copy", () => {
  const params = { target: "database" };
  const input = {
    agentId: "agent-1",
    toolId: "tool-1",
    operation: "run",
    parameters: params,
  };

  const action = createAction(input);

  // Mutating action.parameters should not mutate the original input params
  action.parameters.target = "modified";
  assert.equal(params.target, "database");
});

test("createAction - throws descriptive error when required fields are missing", () => {
  assert.throws(
    () => createAction({}),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Action validation failed/i);
      assert.match(err.message, /agentId is required/i);
      assert.match(err.message, /toolId is required/i);
      assert.match(err.message, /operation is required/i);
      return true;
    }
  );
});

test("createAction - throws descriptive error for whitespace-only required fields", () => {
  assert.throws(
    () =>
      createAction({
        agentId: "   ",
        toolId: "tool-1",
        operation: "run",
      }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /agentId cannot be empty or whitespace-only/i);
      return true;
    }
  );
});

test("createAction - throws descriptive error for invalid environment", () => {
  assert.throws(
    () =>
      createAction({
        agentId: "agent-1",
        toolId: "tool-1",
        operation: "run",
        environment: "invalid_env",
      }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /environment must be one of/i);
      return true;
    }
  );
});

test("createAction - throws descriptive error for invalid payload types", () => {
  const invalidInputs = [null, undefined, "not an object", 42, [1, 2, 3]];

  for (const invalid of invalidInputs) {
    assert.throws(
      () => createAction(invalid),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Action validation failed/i);
        return true;
      }
    );
  }
});
