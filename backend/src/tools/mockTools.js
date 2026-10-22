/**
 * Safe mock tool handlers for AgentShield demonstrations and tests.
 *
 * Requirements:
 * - knowledge_base + read: Returns sample knowledge-base data.
 * - email_service + send_emails: Safe simulated tool (never real external calls).
 * - customer_crm + delete_customers: Safe mock recorder (never deletes real data).
 */

/**
 * Mock handler for knowledge_base.read.
 *
 * @param {object} action - The normalized action object.
 * @returns {object} Sample knowledge-base data.
 */
export function handleKnowledgeBaseRead(action) {
  const count = action.parameters?.count ?? 2;
  return {
    source: "knowledge_base",
    operation: "read",
    requestedCount: count,
    documents: [
      {
        id: "kb-001",
        title: "AgentShield Architecture & Governance",
        summary: "Interception and deterministic policy enforcement for AI agents.",
      },
      {
        id: "kb-002",
        title: "Runtime Security Guardrails",
        summary: "Pre-execution risk assessment and human approval workflows.",
      },
      {
        id: "kb-003",
        title: "Audit Trail Integrity",
        summary: "Comprehensive logging of all authorized and blocked agent calls.",
      },
    ].slice(0, Math.max(1, Math.min(count, 3))),
    retrievedAt: "2026-10-22T14:00:00Z",
  };
}

/**
 * Mock handler for email_service.send_emails.
 * Safe simulation that records simulated transmission without sending real emails.
 *
 * @param {object} action - The normalized action object.
 * @returns {object} Safe simulated email result.
 */
export function handleEmailSend(action) {
  const count = action.parameters?.count ?? 0;
  const destination = action.parameters?.destination ?? "internal";

  return {
    simulated: true,
    tool: "email_service",
    operation: "send_emails",
    recipientCount: count,
    destination,
    status: "SIMULATED_DELIVERY",
    message: `Simulated dispatch of ${count} emails to ${destination}. No real network calls made.`,
  };
}

/**
 * Mock handler for customer_crm.delete_customers.
 * Safe simulation that records simulated execution without deleting any real data.
 *
 * @param {object} action - The normalized action object.
 * @returns {object} Safe simulated CRM deletion report.
 */
export function handleCustomerCrmDelete(action) {
  const count = action.parameters?.count ?? 0;

  return {
    simulated: true,
    tool: "customer_crm",
    operation: "delete_customers",
    recordsTargeted: count,
    actualRecordsDeleted: 0,
    status: "SIMULATED_NO_OP",
    message: "Simulation handler invoked: zero real customer records were deleted.",
  };
}
