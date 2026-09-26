/**
 * Validates that a Supabase client instance has the required query builder interface.
 *
 * @param {Object} client - The client object to validate
 * @param {string} repositoryName - Name of the repository for error context
 * @throws {Error} If client is null, undefined, or lacks a .from() method
 */
export function validateSupabaseClient(client, repositoryName) {
  if (!client || typeof client !== "object" || typeof client.from !== "function") {
    throw new Error(`${repositoryName} requires a valid Supabase client with a .from() method`);
  }
}

/**
 * Handles database response errors consistently.
 * If PostgREST returns PGRST116 (No rows found when .single() was called),
 * we return null instead of throwing.
 *
 * @param {Object} response - The Supabase query response ({ data, error })
 * @param {string} contextMessage - Descriptive error prefix if error occurs
 * @returns {any} data returned by the query
 */
export function handleDbResponse(response, contextMessage) {
  if (response.error) {
    // PostgREST code PGRST116 indicates 0 rows found on single()
    if (response.error.code === "PGRST116") {
      return null;
    }
    const message = response.error.message || "Database error";
    const error = new Error(`${contextMessage}: ${message}`);
    if (typeof response.error.code === "string") error.code = response.error.code;
    throw error;
  }
  return response.data;
}
