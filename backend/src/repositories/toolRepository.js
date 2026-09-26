import { handleDbResponse, validateSupabaseClient } from "./repositoryHelper.js";

export function toToolRow(tool = {}) {
  const row = {};
  for (const field of ["id", "name", "action_type", "target", "description", "risk_tier", "created_at"]) {
    if (tool[field] !== undefined) row[field] = tool[field];
  }
  return row;
}

export function createToolRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "ToolRepository");
  return {
    async createTool(tool) {
      if (!tool || typeof tool !== "object" || Array.isArray(tool)) throw new Error("Failed to create tool: tool object is required");
      const response = await supabaseClient.from("tools").insert(toToolRow(tool)).select().single();
      return handleDbResponse(response, "Failed to create tool");
    },
    async listTools() {
      const response = await supabaseClient.from("tools").select();
      const data = handleDbResponse(response, "Failed to list tools");
      return Array.isArray(data) ? data : [];
    },
    async getToolById(id) {
      if (typeof id !== "string" || !id) throw new Error("Failed to get tool: valid id is required");
      const response = await supabaseClient.from("tools").select().eq("id", id).single();
      return handleDbResponse(response, "Failed to get tool");
    },
    async getToolByName(name) {
      if (typeof name !== "string" || !name) throw new Error("Failed to get tool: valid name is required");
      const response = await supabaseClient.from("tools").select().eq("name", name).single();
      return handleDbResponse(response, "Failed to get tool by name");
    },
  };
}
