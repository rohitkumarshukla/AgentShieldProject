import { validateSupabaseClient, handleDbResponse } from "./repositoryHelper.js";

/**
 * Maps an application agent object to a database row for the agents table.
 * Does not mutate the caller's input object.
 *
 * @param {Object} agent
 * @returns {Object} Database row
 */
export function toAgentRow(agent = {}) {
  const row = {};

  if (agent.id !== undefined) row.id = agent.id;
  if (agent.name !== undefined) row.name = agent.name;
  if (agent.description !== undefined) row.description = agent.description;
  if (agent.status !== undefined) row.status = agent.status;
  if (agent.environment !== undefined) row.environment = agent.environment;
  
  if (agent.metadata !== undefined) {
    row.metadata = typeof agent.metadata === "object" && agent.metadata !== null && !Array.isArray(agent.metadata)
      ? { ...agent.metadata }
      : agent.metadata;
  }

  const createdAt = agent.createdAt || agent.created_at;
  if (createdAt !== undefined) row.created_at = createdAt;

  const updatedAt = agent.updatedAt || agent.updated_at;
  if (updatedAt !== undefined) row.updated_at = updatedAt;

  return row;
}

/**
 * Factory creating an AgentRepository bound to an injected Supabase client.
 *
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Object} AgentRepository instance
 */
export function createAgentRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "AgentRepository");

  return {
    /**
     * Persists a new agent into the database.
     *
     * @param {Object} agent - Application agent object
     * @returns {Promise<Object>} Created database record
     */
    async createAgent(agent) {
      if (!agent || typeof agent !== "object") {
        throw new Error("Failed to create agent: agent object is required");
      }

      const row = toAgentRow(agent);

      const response = await supabaseClient
        .from("agents")
        .insert(row)
        .select()
        .single();

      return handleDbResponse(response, "Failed to create agent");
    },

    /**
     * Retrieves an agent record by its primary key ID.
     *
     * @param {string} id - Agent UUID
     * @returns {Promise<Object|null>} Found record or null
     */
    async getAgentById(id) {
      if (!id || typeof id !== "string") {
        throw new Error("Failed to get agent: valid id is required");
      }

      const response = await supabaseClient
        .from("agents")
        .select()
        .eq("id", id)
        .single();

      return handleDbResponse(response, "Failed to get agent");
    },

    /**
     * Retrieves agent records with optional pagination.
     *
     * @param {Object} [options={}]
     * @param {number} [options.page]
     * @param {number} [options.limit]
     * @returns {Promise<Array<Object> | { items: Array<Object>, hasMore: boolean }>}
     */
    async listAgents(options = {}) {
      const page = options.page;
      const limit = options.limit;

      let query = supabaseClient.from("agents").select();

      if (page !== undefined && limit !== undefined) {
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit);

        const response = await query;
        const data = handleDbResponse(response, "Failed to list agents");
        const rows = Array.isArray(data) ? data : [];

        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;

        return { items, hasMore };
      }

      const response = await query;
      const data = handleDbResponse(response, "Failed to list agents");
      return Array.isArray(data) ? data : [];
    },
  };
}
