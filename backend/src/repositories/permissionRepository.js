import crypto from "node:crypto";
import { handleDbResponse, validateSupabaseClient } from "./repositoryHelper.js";

const sharedPermissionMemoryStore = new Map();

export function toPermissionRow(permission = {}) {
  const row = {};
  for (const field of ["id", "agent_id", "tool_id", "max_scope", "environments", "granted_at", "granted_by"]) {
    if (permission[field] !== undefined) row[field] = Array.isArray(permission[field]) ? [...permission[field]] : permission[field];
  }
  return row;
}

export function createPermissionRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "PermissionRepository");
  const memoryStore = sharedPermissionMemoryStore;

  return {
    async createPermission(permission) {
      if (!permission || typeof permission !== "object" || Array.isArray(permission)) throw new Error("Failed to create permission: permission object is required");
      const row = toPermissionRow(permission);

      try {
        const response = await supabaseClient.from("agent_tool_permissions").insert(row).select().single();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache") || response.error.message?.includes("relation"))) {
          const memRecord = {
            ...row,
            id: row.id || crypto.randomUUID(),
            granted_at: row.granted_at || new Date().toISOString(),
          };
          for (const existing of memoryStore.values()) {
            if (existing.agent_id === memRecord.agent_id && existing.tool_id === memRecord.tool_id) {
              const conflictErr = new Error("Permission grant already exists");
              conflictErr.code = "23505";
              throw conflictErr;
            }
          }
          memoryStore.set(memRecord.id, memRecord);
          return memRecord;
        }
        return handleDbResponse(response, "Failed to create permission");
      } catch (err) {
        if (err?.code === "23505") throw err;
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          const memRecord = {
            ...row,
            id: row.id || crypto.randomUUID(),
            granted_at: row.granted_at || new Date().toISOString(),
          };
          for (const existing of memoryStore.values()) {
            if (existing.agent_id === memRecord.agent_id && existing.tool_id === memRecord.tool_id) {
              const conflictErr = new Error("Permission grant already exists");
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
    async listPermissionsByAgentId(agentId) {
      if (typeof agentId !== "string" || !agentId) throw new Error("Failed to list permissions: valid agent id is required");
      try {
        const response = await supabaseClient.from("agent_tool_permissions").select().eq("agent_id", agentId);
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache"))) {
          return Array.from(memoryStore.values()).filter((p) => p.agent_id === agentId);
        }
        const data = handleDbResponse(response, "Failed to list permissions");
        return Array.isArray(data) ? data : [];
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          return Array.from(memoryStore.values()).filter((p) => p.agent_id === agentId);
        }
        throw err;
      }
    },
    async getPermissionById(id) {
      if (typeof id !== "string" || !id) throw new Error("Failed to get permission: valid id is required");
      try {
        const response = await supabaseClient.from("agent_tool_permissions").select().eq("id", id).single();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache"))) {
          return memoryStore.get(id) || null;
        }
        return handleDbResponse(response, "Failed to get permission");
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          return memoryStore.get(id) || null;
        }
        throw err;
      }
    },
    async deletePermission(id) {
      if (typeof id !== "string" || !id) throw new Error("Failed to delete permission: valid id is required");
      try {
        const response = await supabaseClient.from("agent_tool_permissions").delete().eq("id", id).select().single();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache"))) {
          const existing = memoryStore.get(id);
          if (existing) {
            memoryStore.delete(id);
            return existing;
          }
          return null;
        }
        return handleDbResponse(response, "Failed to delete permission");
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          const existing = memoryStore.get(id);
          if (existing) {
            memoryStore.delete(id);
            return existing;
          }
          return null;
        }
        throw err;
      }
    },
    async getPermissionForAgentAndTool(agentId, toolId) {
      if (typeof agentId !== "string" || !agentId || typeof toolId !== "string" || !toolId) {
        throw new Error("Failed to get permission: agent id and tool id are required");
      }
      try {
        const response = await supabaseClient.from("agent_tool_permissions")
          .select().eq("agent_id", agentId).eq("tool_id", toolId).single();
        if (response?.error && (response.error.code === "PGRST205" || response.error.message?.includes("schema cache"))) {
          for (const p of memoryStore.values()) {
            if (p.agent_id === agentId && p.tool_id === toolId) return p;
          }
          return null;
        }
        return handleDbResponse(response, "Failed to get permission for agent and tool");
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          for (const p of memoryStore.values()) {
            if (p.agent_id === agentId && p.tool_id === toolId) return p;
          }
          return null;
        }
        throw err;
      }
    },
  };
}
