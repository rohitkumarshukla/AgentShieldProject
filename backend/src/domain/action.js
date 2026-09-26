import crypto from "node:crypto";

/**
 * Normalized factory function to produce a canonical AgentShield Action object.
 *
 * An Action is a normalized descriptor representing a real-world tool execution
 * requested by an AI agent. Crucially, the action model contains NO risk scoring,
 * authorization decisions, or tool execution side effects.
 *
 * @param {Object} input - Raw parameters describing the action
 * @returns {Object} Canonical action object
 * @throws {TypeError} When input is null, not a plain object, or an array
 * @throws {RangeError} When date or range operations exceed allowable runtime boundaries
 * @throws {ReferenceError} When referenced symbols or environment APIs are unavailable
 * @throws {Error} Generic runtime fallback for unexpected failures during action creation
 */
export function createAction(input = {}) {
  try {
    // Validate that input is a valid non-null plain object descriptor
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("createAction: 'input' must be a valid non-null object.");
    }

    return {
      id: typeof input.id === "string" && input.id.trim().length > 0
        ? input.id
        : crypto.randomUUID(),
      agentId: input.agentId,
      actionType: input.actionType,
      target: input.target,
      description: input.description,
      scope: {
        type: input.scope?.type ?? "single",
        count: input.scope?.count ?? 1,
      },
      destination: {
        type: input.destination?.type ?? "none",
        value: input.destination?.value !== undefined ? input.destination.value : null,
      },
      environment: input.environment ?? "development",
      sensitivity: {
        level: input.sensitivity?.level ?? "internal",
      },
      financialImpact: input.financialImpact ?? 0,
      metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? { ...input.metadata }
        : {},
      createdAt: typeof input.createdAt === "string" && input.createdAt.trim().length > 0
        ? input.createdAt
        : new Date().toISOString(),
    };
  } catch (error) {
    // =========================================================================
    // Error Type Details & Handling:
    //
    // - TypeError:
    //   Thrown when input is null, a primitive, or an array, or if attempting
    //   incompatible property operations or spreading non-object metadata.
    //
    // - RangeError:
    //   Thrown if Date operations (e.g. toISOString()) or buffer/string lengths
    //   exceed valid numerical or temporal boundaries.
    //
    // - ReferenceError:
    //   Thrown if global dependencies (such as node:crypto or Date) are missing
    //   or unresolvable in the runtime environment.
    //
    // - Error:
    //   Standard fallback error type for any unexpected internal or system failures.
    // =========================================================================
    if (error instanceof TypeError) {
      // TypeError: Incompatible argument or illegal type operation encountered
      throw error;
    } else if (error instanceof RangeError) {
      // RangeError: Numerical or temporal boundary exceeded
      throw error;
    } else if (error instanceof ReferenceError) {
      // ReferenceError: Unresolvable binding or missing runtime API
      throw error;
    } else {
      // Error: Generic or unanticipated exception rethrown for caller handling
      throw error;
    }
  }
}

