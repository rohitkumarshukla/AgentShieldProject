import crypto from "node:crypto";
import { handleDbResponse, validateSupabaseClient } from "./repositoryHelper.js";

const sharedToolMemoryStore = new Map();

export function toToolRow(tool = {}) {
  const row = {};
  for (const field of ["id", "name", "action_type", "target", "description", "risk_tier", "created_at"]) {
    if (tool[field] !== undefined) row[field] = tool[field];
  }
  return row;
}

export function createToolRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "ToolRepository");
  const memoryStore = sharedToolMemoryStore;

  return {
    async createTool(tool) {
      if (!tool || typeof tool !== "object" || Array.isArray(tool)) throw new Error("Failed to create tool: tool object is required");
      const row = toToolRow(tool);

      try {
        const response = await supabaseClient.from("tools").insert(row).select().single();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache") || response.error.message?.includes("relation"))) {
          const memRecord = {
            ...row,
            id: row.id || crypto.randomUUID(),
            created_at: row.created_at || new Date().toISOString(),
          };
          for (const existing of memoryStore.values()) {
            if (existing.name === memRecord.name) {
              const err = new Error("A tool with that name already exists");
              err.code = "23505";
              throw err;
            }
          }
          memoryStore.set(memRecord.id, memRecord);
          return memRecord;
        }
        return handleDbResponse(response, "Failed to create tool");
      } catch (err) {
        if (err?.code === "23505") throw err;
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          const memRecord = {
            ...row,
            id: row.id || crypto.randomUUID(),
            created_at: row.created_at || new Date().toISOString(),
          };
          for (const existing of memoryStore.values()) {
            if (existing.name === memRecord.name) {
              const conflictErr = new Error("A tool with that name already exists");
              conflictErr.code = "23505";
              throw conflictErr;
            }
          }
          memoryStore.set(memRecord.id, memRecord);
          return memRecord;
        }
        throw err;
      }
    },
    async listTools() {
      try {
        const response = await supabaseClient.from("tools").select();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache"))) {
          return Array.from(memoryStore.values());
        }
        const data = handleDbResponse(response, "Failed to list tools");
        return Array.isArray(data) ? data : [];
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          return Array.from(memoryStore.values());
        }
        throw err;
      }
    },
    async getToolById(id) {
      if (typeof id !== "string" || !id) throw new Error("Failed to get tool: valid id is required");
      try {
        const response = await supabaseClient.from("tools").select().eq("id", id).single();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache"))) {
          return memoryStore.get(id) || null;
        }
        return handleDbResponse(response, "Failed to get tool");
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          return memoryStore.get(id) || null;
        }
        throw err;
      }
    },
    async getToolByName(name) {
      if (typeof name !== "string" || !name) throw new Error("Failed to get tool: valid name is required");
      try {
        const response = await supabaseClient.from("tools").select().eq("name", name).single();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache"))) {
          for (const tool of memoryStore.values()) {
            if (tool.name === name) return tool;
          }
          return null;
        }
        return handleDbResponse(response, "Failed to get tool by name");
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          for (const tool of memoryStore.values()) {
            if (tool.name === name) return tool;
          }
          return null;
        }
        throw err;
      }
    },
  };
}
