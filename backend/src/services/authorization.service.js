/**
 * Authorization Service
 *
 * Provides agent-level and user-level authorization checks.
 * Note: Risk scoring and policy rule evaluation are intentionally kept
 * decoupled and handled by their respective engines (RiskEngine / PolicyEngine).
 */

export class AuthorizationError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=403]
   * @param {string} [code='FORBIDDEN']
   * @param {Object} [details={}]
   */
  constructor(message, statusCode = 403, code = "FORBIDDEN", details = {}) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Standard RBAC role-to-permission mappings for AgentShield governance dashboard.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze([
    "agents:read",
    "agents:write",
    "agents:delete",
    "agents:rotate_key",
    "agents:permissions:write",
    "tools:read",
    "tools:execute",
    "tools:test",
    "actions:read",
    "actions:approve",
    "actions:reject",
    "audit:read",
    "audit:export",
    "decisions:read",
    "system:manage",
  ]),
  operator: Object.freeze([
    "agents:read",
    "agents:write",
    "tools:read",
    "tools:execute",
    "tools:test",
    "actions:read",
    "actions:approve",
    "actions:reject",
    "audit:read",
    "decisions:read",
  ]),
  reviewer: Object.freeze([
    "agents:read",
    "tools:read",
    "actions:read",
    "actions:approve",
    "actions:reject",
    "audit:read",
    "decisions:read",
  ]),
  auditor: Object.freeze([
    "agents:read",
    "tools:read",
    "actions:read",
    "audit:read",
    "audit:export",
    "decisions:read",
  ]),
  viewer: Object.freeze([
    "agents:read",
    "tools:read",
    "actions:read",
    "audit:read",
    "decisions:read",
  ]),
});

/**
 * Checks if a user role has a specific permission.
 *
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  try {
    if (!role || typeof role !== "string" || !permission || typeof permission !== "string") {
      return false;
    }
    const normalizedRole = role.trim().toLowerCase();
    const permissions = ROLE_PERMISSIONS[normalizedRole];
    if (!permissions) {
      return false;
    }
    return permissions.includes(permission.trim());
  } catch (_error) {
    return false;
  }
}

/**
 * Validates agent existence and active status.
 *
 * @param {Object} agent
 * @returns {{ valid: boolean, reason?: string, code?: string }}
 */
export function validateAgentStatus(agent) {
  try {
    if (!agent || typeof agent !== "object") {
      return {
        valid: false,
        reason: "Agent identity record is missing or invalid",
        code: "AGENT_NOT_FOUND",
      };
    }

    if (!agent.id || typeof agent.id !== "string") {
      return {
        valid: false,
        reason: "Agent record missing valid unique identifier",
        code: "INVALID_AGENT_ID",
      };
    }

    const status = (agent.status || "").toLowerCase().trim();
    if (status !== "active") {
      return {
        valid: false,
        reason: `Agent is not active (current status: ${agent.status || "unknown"}). Action execution is prohibited.`,
        code: "AGENT_INACTIVE",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: `Agent status evaluation error: ${error.message}`,
      code: "AUTHORIZATION_ERROR",
    };
  }
}

/**
 * Authorizes a proposed tool operation for a given agent based on agent permissions,
 * tool whitelists, blocked operations, environments, and financial parameters.
 *
 * @param {Object} agent - The agent record containing status, metadata, environment, etc.
 * @param {Object} action - The action/tool request { toolId, operation, parameters, environment }
 * @returns {{ authorized: boolean, reason?: string, code?: string, agentId?: string }}
 */
export function authorizeAgentToolAction(agent, action = {}) {
  try {
    // 1. Verify agent status
    const statusCheck = validateAgentStatus(agent);
    if (!statusCheck.valid) {
      return {
        authorized: false,
        reason: statusCheck.reason,
        code: statusCheck.code,
        agentId: agent?.id || null,
      };
    }

    const { toolId, operation, parameters = {}, environment } = action;

    if (!toolId || typeof toolId !== "string" || !toolId.trim()) {
      return {
        authorized: false,
        reason: "Target toolId is required for authorization",
        code: "INVALID_TOOL_ID",
        agentId: agent.id,
      };
    }

    if (!operation || typeof operation !== "string" || !operation.trim()) {
      return {
        authorized: false,
        reason: "Target operation is required for authorization",
        code: "INVALID_OPERATION",
        agentId: agent.id,
      };
    }

    // Extract agent permissions (from metadata or direct field)
    const permissions = agent.metadata?.permissions || agent.permissions || {};
    const normalizedToolId = toolId.trim();
    const normalizedOp = operation.trim();

    // 2. Check environment restrictions
    if (environment || agent.environment) {
      const targetEnv = (environment || agent.environment || "").trim().toLowerCase();
      const allowedEnvs = Array.isArray(permissions.environmentRestrictions)
        ? permissions.environmentRestrictions.map((e) => String(e).toLowerCase().trim())
        : null;

      if (allowedEnvs && allowedEnvs.length > 0 && !allowedEnvs.includes(targetEnv)) {
        return {
          authorized: false,
          reason: `Agent is not authorized to execute actions in environment '${targetEnv}'. Allowed: [${allowedEnvs.join(", ")}]`,
          code: "ENVIRONMENT_UNAUTHORIZED",
          agentId: agent.id,
        };
      }
    }

    // 3. Check allowed tools whitelist
    const allowedTools = Array.isArray(permissions.allowedTools)
      ? permissions.allowedTools.map((t) => String(t).trim())
      : ["*"];

    if (!allowedTools.includes("*") && !allowedTools.includes(normalizedToolId)) {
      return {
        authorized: false,
        reason: `Agent is not authorized to invoke tool '${normalizedToolId}'. Allowed tools: [${allowedTools.join(", ")}]`,
        code: "TOOL_UNAUTHORIZED",
        agentId: agent.id,
      };
    }

    // 4. Check blocked operations blacklist
    const blockedOperations = Array.isArray(permissions.blockedOperations)
      ? permissions.blockedOperations.map((o) => String(o).trim())
      : [];

    if (blockedOperations.includes(normalizedOp) || blockedOperations.includes(`${normalizedToolId}.${normalizedOp}`)) {
      return {
        authorized: false,
        reason: `Operation '${normalizedOp}' on tool '${normalizedToolId}' is explicitly restricted for this agent.`,
        code: "OPERATION_BLOCKED_BY_PERMISSIONS",
        agentId: agent.id,
      };
    }

    // 5. Check financial limits if defined in permissions
    if (typeof permissions.maxFinancialLimit === "number" && permissions.maxFinancialLimit >= 0) {
      const requestedAmount = typeof parameters?.amount === "number"
        ? parameters.amount
        : typeof parameters?.value === "number"
        ? parameters.value
        : null;

      if (requestedAmount !== null && requestedAmount > permissions.maxFinancialLimit) {
        return {
          authorized: false,
          reason: `Requested amount ($${requestedAmount}) exceeds agent's max financial limit of $${permissions.maxFinancialLimit}`,
          code: "FINANCIAL_LIMIT_EXCEEDED",
          agentId: agent.id,
        };
      }
    }

    return {
      authorized: true,
      agentId: agent.id,
    };
  } catch (error) {
    return {
      authorized: false,
      reason: `Authorization evaluation failure: ${error.message}`,
      code: "AUTHORIZATION_ERROR",
      agentId: agent?.id || null,
    };
  }
}

/**
 * Creates an Authorization Service instance with async repository integration.
 *
 * @param {Object} [options={}]
 * @param {Object} [options.agentRepository]
 * @returns {Object}
 */
export function createAuthorizationService(options = {}) {
  const { agentRepository } = options;

  return {
    /**
     * Authorizes an agent action asynchronously by looking up the agent from repository if needed.
     *
     * @param {string|Object} agentOrId - Agent UUID string or Agent record object
     * @param {Object} action - Tool request { toolId, operation, parameters, environment }
     * @returns {Promise<{ authorized: boolean, reason?: string, code?: string, agentId?: string }>}
     */
    async authorizeAgentAction(agentOrId, action = {}) {
      try {
        let agent = null;

        if (typeof agentOrId === "string") {
          if (!agentRepository) {
            return {
              authorized: false,
              reason: "Agent repository not configured to resolve agent by ID",
              code: "REPOSITORY_UNAVAILABLE",
              agentId: agentOrId,
            };
          }
          agent = await agentRepository.getAgentById(agentOrId);
          if (!agent) {
            return {
              authorized: false,
              reason: `Agent with ID '${agentOrId}' not found`,
              code: "AGENT_NOT_FOUND",
              agentId: agentOrId,
            };
          }
        } else if (agentOrId && typeof agentOrId === "object") {
          agent = agentOrId;
        } else {
          return {
            authorized: false,
            reason: "Agent identifier or record must be provided",
            code: "INVALID_AGENT",
            agentId: null,
          };
        }

        return authorizeAgentToolAction(agent, action);
      } catch (error) {
        return {
          authorized: false,
          reason: `Authorization service error: ${error.message}`,
          code: "AUTHORIZATION_SERVICE_ERROR",
          agentId: typeof agentOrId === "string" ? agentOrId : agentOrId?.id || null,
        };
      }
    },

    /**
     * Authorizes a dashboard/API user for a required permission or role.
     *
     * @param {Object} user - User object { id, role, email }
     * @param {string} requiredPermission - Permission string (e.g. 'actions:approve')
     * @returns {boolean}
     */
    authorizeUser(user, requiredPermission) {
      try {
        if (!user || typeof user !== "object") {
          return false;
        }
        const userRole = user.role || user.user_metadata?.role || "viewer";
        return hasPermission(userRole, requiredPermission);
      } catch (_error) {
        return false;
      }
    },

    /**
     * Checks if a user has any of the specified roles.
     *
     * @param {Object} user
     * @param {string[]} allowedRoles
     * @returns {boolean}
     */
    hasAnyRole(user, allowedRoles = []) {
      try {
        if (!user || typeof user !== "object" || !Array.isArray(allowedRoles)) {
          return false;
        }
        const userRole = (user.role || user.user_metadata?.role || "viewer").toLowerCase().trim();
        const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase().trim());
        return normalizedAllowed.includes(userRole);
      } catch (_error) {
        return false;
      }
    },
  };
}

/**
 * Express middleware factory to require specific user roles for a route.
 *
 * @param {string[]} allowedRoles
 * @returns {Function} Express middleware (req, res, next)
 */
export function requireUserRole(...allowedRoles) {
  const rolesList = allowedRoles.flat();
  return function userRoleMiddleware(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required to access this resource",
          },
        });
      }

      const userRole = (user.role || user.user_metadata?.role || "viewer").toLowerCase().trim();
      const authorized = rolesList.map((r) => String(r).toLowerCase().trim()).includes(userRole);

      if (!authorized) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `User role '${userRole}' is not authorized. Required: [${rolesList.join(", ")}]`,
          },
        });
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTHORIZATION_MIDDLEWARE_ERROR",
          message: `Internal authorization error: ${error.message}`,
        },
      });
    }
  };
}

/**
 * Express middleware factory to require a specific permission for a route.
 *
 * @param {string} permission
 * @returns {Function} Express middleware (req, res, next)
 */
export function requireUserPermission(permission) {
  return function userPermissionMiddleware(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required to access this resource",
          },
        });
      }

      const userRole = (user.role || user.user_metadata?.role || "viewer").toLowerCase().trim();
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `User role '${userRole}' lacks required permission '${permission}'`,
          },
        });
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTHORIZATION_MIDDLEWARE_ERROR",
          message: `Internal authorization error: ${error.message}`,
        },
      });
    }
  };
}

export default {
  AuthorizationError,
  ROLE_PERMISSIONS,
  hasPermission,
  validateAgentStatus,
  authorizeAgentToolAction,
  createAuthorizationService,
  requireUserRole,
  requireUserPermission,
};
