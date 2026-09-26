import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createToolService } from "./toolService.js";

const TOOL = { id: "tool-id", name: "CRM.queryRecords", action_type: "read", risk_tier: "low", api_key_hash: "never-return" };

describe("ToolService", () => {
  it("creates a validated tool and safely shapes the result", async () => {
    let received;
    const service = createToolService({ async createTool(input) { received = input; return TOOL; } });
    assert.deepEqual(await service.create({ name: " CRM.queryRecords ", action_type: " read ", risk_tier: "low" }), {
      id: "tool-id", name: "CRM.queryRecords", action_type: "read", risk_tier: "low",
    });
    assert.deepEqual(received, { name: "CRM.queryRecords", action_type: "read", risk_tier: "low" });
  });

  it("rejects missing required values, invalid risk tiers, and unknown fields", async () => {
    const service = createToolService({ async createTool() {} });
    for (const body of [{ action_type: "read" }, { name: "x" }, { name: "x", action_type: "read", secret: "x" }, { name: "x", action_type: "read", risk_tier: "extreme" }]) {
      await assert.rejects(() => service.create(body), (error) => error.statusCode === 400);
    }
    await assert.rejects(() => service.create({ name: "x", action_type: "read", description: 1 }), /description must be a string/);
  });

  it("maps a duplicate name to a conflict and supports list/get/missing get", async () => {
    const service = createToolService({
      async createTool() { const error = new Error("duplicate"); error.code = "23505"; throw error; },
      async listTools() { return [TOOL]; },
      async getToolById(id) { return id === "tool-id" ? TOOL : null; },
    });
    await assert.rejects(() => service.create({ name: "CRM.queryRecords", action_type: "read" }), (error) => error.statusCode === 409 && error.code === "TOOL_CONFLICT");
    assert.equal((await service.list())[0].name, TOOL.name);
    assert.equal((await service.get("tool-id")).name, TOOL.name);
    await assert.rejects(() => service.get("missing"), (error) => error.statusCode === 404);
  });
});
