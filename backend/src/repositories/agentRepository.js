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
  if (agent.api_key_hash !== undefined) row.api_key_hash = agent.api_key_hash;
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
     * Retrieves all agent records.
     *
     * @returns {Promise<Array<Object>>} Array of records, or empty array if none found
     */
    async listAgents() {
      const response = await supabaseClient
        .from("agents")
        .select();

      const data = handleDbResponse(response, "Failed to list agents");
      return Array.isArray(data) ? data : [];
    },

    async updateAgent(id, updates) {
      if (!id || typeof id !== "string") throw new Error("Failed to update agent: valid id is required");
      const response = await supabaseClient.from("agents").update(toAgentRow(updates)).eq("id", id).select().single();
      return handleDbResponse(response, "Failed to update agent");
    },

    async updateApiKeyHash(id, apiKeyHash) {
      if (!id || typeof id !== "string") throw new Error("Failed to update agent API key: valid id is required");
      if (typeof apiKeyHash !== "string" || !apiKeyHash) throw new Error("Failed to update agent API key: hash is required");
      const response = await supabaseClient.from("agents").update({ api_key_hash: apiKeyHash }).eq("id", id).select().single();
      return handleDbResponse(response, "Failed to update agent API key");
    },
  };
}
