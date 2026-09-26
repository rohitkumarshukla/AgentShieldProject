import { isValidUuid } from "../domain/agentValidator.js";

const PERMISSION_FIELDS = new Set(["agent_id", "tool_id", "max_scope", "environments", "granted_by"]);
const SCOPE_RANK = new Map([["single", 1], ["bulk", 2], ["all", 3]]);
const PUBLIC_PERMISSION_FIELDS = ["id", "agent_id", "tool_id", "max_scope", "environments", "granted_at", "granted_by"];

export class PermissionServiceError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_PERMISSION") {
    super(message);
    this.name = "PermissionServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function safePermission(permission) {
  if (!permission) return null;
  return Object.fromEntries(PUBLIC_PERMISSION_FIELDS.filter((field) => permission[field] !== undefined).map((field) => [
    field,
    Array.isArray(permission[field]) ? [...permission[field]] : permission[field],
  ]));
}

export function createPermissionService({ agentRepository, toolRepository, permissionRepository }) {
  function validate(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length === 0) {
      throw new PermissionServiceError("Request body must be a non-empty object");
    }
    const unknown = Object.keys(input).filter((field) => !PERMISSION_FIELDS.has(field));
    if (unknown.length) throw new PermissionServiceError(`Unsupported permission field: ${unknown[0]}`);
    if (!isValidUuid(input.agent_id)) throw new PermissionServiceError("agent_id must be a valid UUID");
    if (!isValidUuid(input.tool_id)) throw new PermissionServiceError("tool_id must be a valid UUID");
    if (input.max_scope !== undefined && input.max_scope !== null && typeof input.max_scope !== "string") {
      throw new PermissionServiceError("max_scope must be a string or null");
    }
    if (input.environments !== undefined && (!Array.isArray(input.environments) || input.environments.some((value) => typeof value !== "string"))) {
      throw new PermissionServiceError("environments must be an array of strings");
    }
    if (input.granted_by !== undefined && input.granted_by !== null && typeof input.granted_by !== "string") {
      throw new PermissionServiceError("granted_by must be a string or null");
    }
    return { ...input, agent_id: input.agent_id.trim(), tool_id: input.tool_id.trim() };
  }

  async function requireAgent(agentId) {
    const agent = await agentRepository.getAgentById(agentId);
    if (!agent) throw new PermissionServiceError("Agent not found", 404, "AGENT_NOT_FOUND");
    return agent;
  }

  async function requireTool(toolId) {
    const tool = await toolRepository.getToolById(toolId);
    if (!tool) throw new PermissionServiceError("Tool not found", 404, "TOOL_NOT_FOUND");
    return tool;
  }

  return {
    async create(input) {
      const normalized = validate(input);
      await requireAgent(normalized.agent_id);
      await requireTool(normalized.tool_id);
      try {
        const permission = await permissionRepository.createPermission(normalized);
        if (!permission) throw new Error("Permission creation returned no record");
        return safePermission(permission);
      } catch (error) {
        if (error?.code === "23505") {
          throw new PermissionServiceError("Permission already exists for this agent and tool", 409, "PERMISSION_CONFLICT");
        }
        throw error;
      }
    },
    async listByAgentId(agentId) {
      if (!isValidUuid(agentId)) throw new PermissionServiceError("agentId must be a valid UUID");
      const normalizedAgentId = agentId.trim();
      await requireAgent(normalizedAgentId);
      return (await permissionRepository.listPermissionsByAgentId(normalizedAgentId)).map(safePermission);
    },
    async delete(id) {
      if (!isValidUuid(id)) throw new PermissionServiceError("Permission ID must be a valid UUID");
      const permissionId = id.trim();
      const existing = await permissionRepository.getPermissionById(permissionId);
      if (!existing) throw new PermissionServiceError("Permission not found", 404, "PERMISSION_NOT_FOUND");
      const deleted = await permissionRepository.deletePermission(permissionId);
      if (!deleted) throw new PermissionServiceError("Permission not found", 404, "PERMISSION_NOT_FOUND");
      return safePermission(deleted);
    },
    async checkAgentToolPermission(agentId, toolId, context = {}) {
      if (!isValidUuid(agentId) || !isValidUuid(toolId)) throw new PermissionServiceError("agentId and toolId must be valid UUIDs");
      const normalizedAgentId = agentId.trim();
      const normalizedToolId = toolId.trim();
      const tool = await toolRepository.getToolById(normalizedToolId);
      if (!tool) return { allowed: false, permission: null };
      if (context.actionType && tool.action_type !== context.actionType) {
        return { allowed: false, permission: null };
      }
      const permission = await permissionRepository.getPermissionForAgentAndTool(normalizedAgentId, normalizedToolId);
      if (!permission) return { allowed: false, permission: null };

      if (permission.max_scope !== undefined && permission.max_scope !== null) {
        const requestedRank = SCOPE_RANK.get(context.scope?.type);
        const allowedRank = SCOPE_RANK.get(permission.max_scope);
        if (!requestedRank || !allowedRank || requestedRank > allowedRank) return { allowed: false, permission: null };
      }
      if (Array.isArray(permission.environments) && !permission.environments.includes(context.environment)) {
        return { allowed: false, permission: null };
      }
      return { allowed: true, permission: safePermission(permission) };
    },
  };
}
