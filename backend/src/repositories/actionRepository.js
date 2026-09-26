import { validateSupabaseClient, handleDbResponse } from "./repositoryHelper.js";

/**
 * Maps an application action object to a database row for the actions table.
 * Preserves nested JSON structures without mutating the caller's input object.
 *
 * @param {Object} action
 * @returns {Object} Database row
 */
export function toActionRow(action = {}) {
  const row = {};

  if (action.id !== undefined) row.id = action.id;

  const agentId = action.agentId !== undefined ? action.agentId : action.agent_id;
  if (agentId !== undefined) row.agent_id = agentId;

  const actionType = action.actionType !== undefined ? action.actionType : action.action_type;
  if (actionType !== undefined) row.action_type = actionType;

  if (action.target !== undefined) row.target = action.target;
  if (action.description !== undefined) row.description = action.description;

  if (action.scope !== undefined) {
    row.scope = typeof action.scope === "object" && action.scope !== null && !Array.isArray(action.scope)
      ? { ...action.scope }
      : action.scope;
  }

  if (action.destination !== undefined) {
    row.destination = typeof action.destination === "object" && action.destination !== null && !Array.isArray(action.destination)
      ? { ...action.destination }
      : action.destination;
  }

  if (action.environment !== undefined) row.environment = action.environment;

  if (action.sensitivity !== undefined) {
    row.sensitivity = typeof action.sensitivity === "object" && action.sensitivity !== null && !Array.isArray(action.sensitivity)
      ? { ...action.sensitivity }
      : action.sensitivity;
  }

  const financialImpact = action.financialImpact !== undefined ? action.financialImpact : action.financial_impact;
  if (financialImpact !== undefined) row.financial_impact = financialImpact;

  if (action.metadata !== undefined) {
    row.metadata = typeof action.metadata === "object" && action.metadata !== null && !Array.isArray(action.metadata)
      ? { ...action.metadata }
      : action.metadata;
  }

  const createdAt = action.createdAt !== undefined ? action.createdAt : action.created_at;
  if (createdAt !== undefined) row.created_at = createdAt;

  return row;
}

/**
 * Factory creating an ActionRepository bound to an injected Supabase client.
 *
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Object} ActionRepository instance
 */
export function createActionRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "ActionRepository");

  return {
    /**
     * Persists a new action into the database.
     *
     * @param {Object} action - Application action object
     * @returns {Promise<Object>} Created database record
     */
    async createAction(action) {
      if (!action || typeof action !== "object") {
        throw new Error("Failed to create action: action object is required");
      }

      const row = toActionRow(action);

      const response = await supabaseClient
        .from("actions")
        .insert(row)
        .select()
        .single();

      return handleDbResponse(response, "Failed to create action");
    },

    /**
     * Retrieves an action record by its primary key ID.
     *
     * @param {string} id - Action UUID
     * @returns {Promise<Object|null>} Found record or null
     */
    async getActionById(id) {
      if (!id || typeof id !== "string") {
        throw new Error("Failed to get action: valid id is required");
      }

      const response = await supabaseClient
        .from("actions")
        .select()
        .eq("id", id)
        .single();

      return handleDbResponse(response, "Failed to get action");
    },

    /**
     * Retrieves all action records associated with a specific agent ID.
     *
     * @param {string} agentId - Agent UUID
     * @returns {Promise<Array<Object>>} Array of records, or empty array if none found
     */
    async listActionsByAgentId(agentId) {
      if (!agentId || typeof agentId !== "string") {
        throw new Error("Failed to list actions by agent: valid agentId is required");
      }

      const response = await supabaseClient
        .from("actions")
        .select()
        .eq("agent_id", agentId);

      const data = handleDbResponse(response, "Failed to list actions by agent");
      return Array.isArray(data) ? data : [];
    },
  };
}
