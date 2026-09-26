import { handleDbResponse, validateSupabaseClient } from "./repositoryHelper.js";

export function toPermissionRow(permission = {}) {
  const row = {};
  for (const field of ["id", "agent_id", "tool_id", "max_scope", "environments", "granted_at", "granted_by"]) {
    if (permission[field] !== undefined) row[field] = Array.isArray(permission[field]) ? [...permission[field]] : permission[field];
  }
  return row;
}

export function createPermissionRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "PermissionRepository");
  return {
    async createPermission(permission) {
      if (!permission || typeof permission !== "object" || Array.isArray(permission)) throw new Error("Failed to create permission: permission object is required");
      const response = await supabaseClient.from("agent_tool_permissions").insert(toPermissionRow(permission)).select().single();
      return handleDbResponse(response, "Failed to create permission");
    },
    async listPermissionsByAgentId(agentId) {
      if (typeof agentId !== "string" || !agentId) throw new Error("Failed to list permissions: valid agent id is required");
      const response = await supabaseClient.from("agent_tool_permissions").select().eq("agent_id", agentId);
      const data = handleDbResponse(response, "Failed to list permissions");
      return Array.isArray(data) ? data : [];
    },
    async getPermissionById(id) {
      if (typeof id !== "string" || !id) throw new Error("Failed to get permission: valid id is required");
      const response = await supabaseClient.from("agent_tool_permissions").select().eq("id", id).single();
      return handleDbResponse(response, "Failed to get permission");
    },
    async deletePermission(id) {
      if (typeof id !== "string" || !id) throw new Error("Failed to delete permission: valid id is required");
      const response = await supabaseClient.from("agent_tool_permissions").delete().eq("id", id).select().single();
      return handleDbResponse(response, "Failed to delete permission");
    },
    async getPermissionForAgentAndTool(agentId, toolId) {
      if (typeof agentId !== "string" || !agentId || typeof toolId !== "string" || !toolId) {
        throw new Error("Failed to get permission: agent id and tool id are required");
      }
      const response = await supabaseClient.from("agent_tool_permissions")
        .select().eq("agent_id", agentId).eq("tool_id", toolId).single();
      return handleDbResponse(response, "Failed to get permission for agent and tool");
    },
  };
}
