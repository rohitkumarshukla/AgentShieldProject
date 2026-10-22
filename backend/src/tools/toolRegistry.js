/**
 * Explicit registry mapping supported tool IDs and operations to known handlers.
 *
 * Requirements:
 * - Explicitly maps supported tool IDs and operations to known handlers.
 * - Unknown tools or unsupported operations fail closed and are never executed.
 */

import {
  handleKnowledgeBaseRead,
  handleEmailSend,
  handleCustomerCrmDelete,
} from "./mockTools.js";

const registry = new Map();

/**
 * Normalizes toolId and operation into a registry lookup key.
 *
 * @param {string} toolId
 * @param {string} operation
 * @returns {string}
 */
export function normalizeRegistryKey(toolId, operation) {
  if (typeof toolId !== "string" || typeof operation !== "string") {
    return "";
  }
  return `${toolId.trim().toLowerCase()}:${operation.trim().toLowerCase()}`;
}

/**
 * Registers a tool handler function for an explicit toolId and operation.
 *
 * @param {string} toolId
 * @param {string} operation
 * @param {Function} handler
 */
export function registerToolHandler(toolId, operation, handler) {
  const key = normalizeRegistryKey(toolId, operation);
  if (!key) {
    throw new TypeError("toolId and operation must be non-empty strings.");
  }
  if (typeof handler !== "function") {
    throw new TypeError("handler must be a function.");
  }
  registry.set(key, handler);
}

// Explicitly register supported mock tools and operations
registerToolHandler("knowledge_base", "read", handleKnowledgeBaseRead);
registerToolHandler("email_service", "send_emails", handleEmailSend);
registerToolHandler("customer_crm", "delete_customers", handleCustomerCrmDelete);

/**
 * Checks whether a tool and operation combination is registered.
 *
 * @param {string} toolId
 * @param {string} operation
 * @returns {boolean}
 */
export function hasToolHandler(toolId, operation) {
  const key = normalizeRegistryKey(toolId, operation);
  return registry.has(key);
}

/**
 * Retrieves the registered tool handler.
 * Returns null if the tool or operation is unknown (fail closed).
 *
 * @param {string} toolId
 * @param {string} operation
 * @returns {Function|null}
 */
export function getToolHandler(toolId, operation) {
  const key = normalizeRegistryKey(toolId, operation);
  return registry.get(key) || null;
}
