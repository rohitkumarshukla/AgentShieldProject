import crypto from "node:crypto";
import { isValidUuid } from "../domain/agentValidator.js";

const sharedApprovalMemoryStore = new Map();

/**
 * Creates an ApprovalRepository instance backed by Supabase.
 *
 * @param {Object} supabaseClient
 * @returns {Object}
 */
export function createApprovalRepository(supabaseClient) {
  if (!supabaseClient || typeof supabaseClient.from !== "function") {
    throw new Error("createApprovalRepository requires a valid Supabase client instance");
  }

  const memoryStore = sharedApprovalMemoryStore;

  return {
    /**
     * Creates a new pending approval record.
     *
     * @param {Object} input
     * @returns {Promise<Object>}
     */
    async createApproval(input = {}) {
      const id = input.id && isValidUuid(input.id) ? input.id : crypto.randomUUID();
      const payload = {
        id,
        action_id: input.actionId || input.action_id,
        decision_id: input.decisionId || input.decision_id || null,
        status: input.status || "pending",
        reviewer: input.reviewer || null,
        reason: input.reason || null,
        metadata: input.metadata || {},
        created_at: input.createdAt || input.created_at || new Date().toISOString(),
        resolved_at: input.resolvedAt || input.resolved_at || null,
      };

      try {
        const { data, error } = await supabaseClient
          .from("approvals")
          .insert(payload)
          .select()
          .single();

        if (error) {
          if (error.message?.includes("schema cache") || error.message?.includes("relation") || error.code === "42P01" || error.code === "PGRST205") {
            memoryStore.set(id, payload);
            return payload;
          }
          throw new Error(`Failed to create approval record: ${error.message}`);
        }

        return data;
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          memoryStore.set(id, payload);
          return payload;
        }
        throw new Error(`Approval persistence failure: ${err.message}`);
      }
    },

    /**
     * Retrieves an approval record by ID.
     *
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getApprovalById(id) {
      try {
        if (!id || typeof id !== "string") {
          throw new Error("Invalid approval ID format");
        }

        const { data, error } = await supabaseClient
          .from("approvals")
          .select("*")
          .eq("id", id.trim())
          .single();

        if (error) {
          if (error.code === "PGRST116" || error.message?.includes("0 rows")) {
            return memoryStore.get(id.trim()) || null;
          }
          if (error.message?.includes("schema cache") || error.message?.includes("relation") || error.code === "42P01" || error.code === "PGRST205") {
            return memoryStore.get(id.trim()) || null;
          }
          throw new Error(`Approval query failed: ${error.message}`);
        }

        return data;
      } catch (err) {
        if (err.message?.includes("0 rows") || err.message?.includes("PGRST116") || err.message?.includes("schema cache") || err.message?.includes("relation")) {
          return memoryStore.get(id?.trim?.() || id) || null;
        }
        throw new Error(`Approval retrieval error: ${err.message}`);
      }
    },

    /**
     * Lists approvals with optional status filter and pagination.
     *
     * @param {Object} [options={}]
     * @param {string} [options.status]
     * @param {number} [options.page=1]
     * @param {number} [options.limit=20]
     * @returns {Promise<{ items: Array<Object>, hasMore: boolean, total?: number }>}
     */
    async listApprovals({ status, page = 1, limit = 20 } = {}) {
      try {
        const from = (page - 1) * limit;
        const to = from + limit;

        let query = supabaseClient
          .from("approvals")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (status && typeof status === "string") {
          query = query.eq("status", status.trim().toLowerCase());
        }

        const { data, error } = await query;
        if (error) {
          if (error.message?.includes("schema cache") || error.message?.includes("relation") || error.code === "42P01" || error.code === "PGRST205") {
            let items = Array.from(memoryStore.values()).reverse();
            if (status) {
              items = items.filter((a) => a.status?.toLowerCase() === status.trim().toLowerCase());
            }
            const paginated = items.slice(from, from + limit);
            return { items: paginated, hasMore: items.length > from + limit };
          }
          throw new Error(`Failed to list approvals: ${error.message}`);
        }

        const items = Array.isArray(data) ? data : [];
        const hasMore = items.length > limit;
        const trimmedItems = hasMore ? items.slice(0, limit) : items;

        return {
          items: trimmedItems,
          hasMore,
        };
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          let items = Array.from(memoryStore.values()).reverse();
          if (status) {
            items = items.filter((a) => a.status?.toLowerCase() === status.trim().toLowerCase());
          }
          const from = (page - 1) * limit;
          const paginated = items.slice(from, from + limit);
          return { items: paginated, hasMore: items.length > from + limit };
        }
        throw new Error(`Approval list error: ${err.message}`);
      }
    },

    /**
     * Resolves an approval (approve or reject).
     *
     * @param {string} id
     * @param {Object} resolution
     * @param {"approved"|"rejected"} resolution.status
     * @param {string} resolution.reviewer
     * @param {string} [resolution.reason]
     * @returns {Promise<Object>}
     */
    async resolveApproval(id, { status, reviewer, reason } = {}) {
      try {
        if (!id || typeof id !== "string") {
          throw new Error("Invalid approval ID");
        }

        const updates = {
          status: status || "approved",
          reviewer: reviewer || "system_reviewer",
          reason: reason || null,
          resolved_at: new Date().toISOString(),
        };

        const { data, error } = await supabaseClient
          .from("approvals")
          .update(updates)
          .eq("id", id.trim())
          .select()
          .single();

        if (error) {
          if (error.message?.includes("schema cache") || error.message?.includes("relation") || error.code === "42P01" || error.code === "PGRST205") {
            const existing = memoryStore.get(id.trim());
            if (!existing) {
              throw new Error(`Approval not found with ID ${id}`);
            }
            const updated = { ...existing, ...updates };
            memoryStore.set(id.trim(), updated);
            return updated;
          }
          throw new Error(`Failed to resolve approval: ${error.message}`);
        }

        return data;
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          const existing = memoryStore.get(id.trim());
          if (!existing) {
            throw new Error(`Approval not found with ID ${id}`);
          }
          const updated = { ...existing, ...updates };
          memoryStore.set(id.trim(), updated);
          return updated;
        }
        throw new Error(`Approval resolution failure: ${err.message}`);
      }
    },
  };
}

export default {
  createApprovalRepository,
};
