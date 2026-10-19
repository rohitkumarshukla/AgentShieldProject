import test from "node:test";
import assert from "node:assert/strict";
import { validateAction } from "../src/domain/actionValidator.js";

test("validateAction - returns valid for a fully specified action", () => {
  const input = {
    agentId: "agent-007",
    toolId: "file_system",
    operation: "delete_file",
    parameters: { path: "/tmp/data.txt" },
    environment: "production",
    userPrompt: "Please clean up temporary files",
  };

  const result = validateAction(input);

  assert.deepEqual(result, {
    valid: true,
    errors: [],
  });
});

test("validateAction - returns valid when only required fields are provided", () => {
  const input = {
    agentId: "agent-123",
    toolId: "web_search",
    operation: "query",
  };

  const result = validateAction(input);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateAction - accepts all allowed environment values", () => {
  const environments = ["development", "staging", "production"];

  for (const env of environments) {
    const input = {
      agentId: "agent-1",
      toolId: "tool-1",
      operation: "run",
      environment: env,
    };

    const result = validateAction(input);
    assert.equal(result.valid, true, `Expected environment "${env}" to be valid`);
    assert.equal(result.errors.length, 0);
  }
});

test("validateAction - rejects non-object or nullish payloads", () => {
  const invalidPayloads = [null, undefined, 42, "string", true, [1, 2, 3]];

  for (const payload of invalidPayloads) {
    const result = validateAction(payload);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.match(result.errors[0], /plain object/i);
  }
});

test("validateAction - rejects missing required fields", () => {
  // Missing all required fields
  const emptyResult = validateAction({});
  assert.equal(emptyResult.valid, false);
  assert.equal(emptyResult.errors.length, 3);
  assert.ok(emptyResult.errors.some((e) => e.includes("agentId")));
  assert.ok(emptyResult.errors.some((e) => e.includes("toolId")));
  assert.ok(emptyResult.errors.some((e) => e.includes("operation")));

  // Missing agentId only
  const noAgentId = validateAction({ toolId: "tool-1", operation: "read" });
  assert.equal(noAgentId.valid, false);
  assert.ok(noAgentId.errors.some((e) => e.includes("agentId")));

  // Missing toolId only
  const noToolId = validateAction({ agentId: "agent-1", operation: "read" });
  assert.equal(noToolId.valid, false);
  assert.ok(noToolId.errors.some((e) => e.includes("toolId")));

  // Missing operation only
  const noOperation = validateAction({ agentId: "agent-1", toolId: "tool-1" });
  assert.equal(noOperation.valid, false);
  assert.ok(noOperation.errors.some((e) => e.includes("operation")));
});

test("validateAction - rejects empty or whitespace-only required fields", () => {
  const whitespaceCases = [
    { agentId: "", toolId: "tool-1", operation: "read", field: "agentId" },
    { agentId: "   \t \n  ", toolId: "tool-1", operation: "read", field: "agentId" },
    { agentId: "agent-1", toolId: "", operation: "read", field: "toolId" },
    { agentId: "agent-1", toolId: "   ", operation: "read", field: "toolId" },
    { agentId: "agent-1", toolId: "tool-1", operation: "", field: "operation" },
    { agentId: "agent-1", toolId: "tool-1", operation: "  \n  ", field: "operation" },
  ];

  for (const testCase of whitespaceCases) {
    const result = validateAction(testCase);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes(testCase.field) && e.includes("whitespace")),
      `Expected whitespace error for ${testCase.field}`
    );
  }
});

test("validateAction - rejects non-string types for required fields", () => {
  const typeCases = [
    { agentId: 123, toolId: "tool-1", operation: "read", field: "agentId" },
    { agentId: "agent-1", toolId: false, operation: "read", field: "toolId" },
    { agentId: "agent-1", toolId: "tool-1", operation: { op: "read" }, field: "operation" },
  ];

  for (const testCase of typeCases) {
    const result = validateAction(testCase);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes(testCase.field) && e.includes("string")),
      `Expected type error for ${testCase.field}`
    );
  }
});

test("validateAction - rejects invalid parameters field", () => {
  const invalidParameters = [
    "invalid_string",
    123,
    null,
    [1, 2, 3], // Arrays where plain objects are expected
    [],
  ];

  for (const param of invalidParameters) {
    const result = validateAction({
      agentId: "agent-1",
      toolId: "tool-1",
      operation: "read",
      parameters: param,
    });

    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("parameters")),
      `Expected parameters error for ${typeof param}`
    );
  }
});

test("validateAction - rejects unsupported environment values and types", () => {
  const invalidEnvironments = ["test", "local", "prod", "Development", 123, true];

  for (const env of invalidEnvironments) {
    const result = validateAction({
      agentId: "agent-1",
      toolId: "tool-1",
      operation: "read",
      environment: env,
    });

    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("environment")),
      `Expected environment error for ${env}`
    );
  }
});

test("validateAction - rejects invalid userPrompt types", () => {
  const invalidUserPrompts = [123, true, {}, ["prompt"], null];

  for (const prompt of invalidUserPrompts) {
    const result = validateAction({
      agentId: "agent-1",
      toolId: "tool-1",
      operation: "read",
      userPrompt: prompt,
    });

    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("userPrompt")),
      `Expected userPrompt error for ${typeof prompt}`
    );
  }
});

test("validateAction - does not modify the original input object", () => {
  const originalInput = Object.freeze({
    agentId: " agent-1 ",
    toolId: " tool-1 ",
    operation: " read ",
    parameters: Object.freeze({ key: "val" }),
    environment: "development",
    userPrompt: "prompt",
  });

  // Calling validateAction on a frozen object will throw if it tries to modify properties
  assert.doesNotThrow(() => {
    const result = validateAction(originalInput);
    assert.equal(result.valid, true);
  });

  // Verify fields were not trimmed or altered in original input
  assert.equal(originalInput.agentId, " agent-1 ");
  assert.equal(originalInput.toolId, " tool-1 ");
  assert.equal(originalInput.operation, " read ");
});
