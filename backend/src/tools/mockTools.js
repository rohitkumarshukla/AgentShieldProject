/**
 * Mock Enterprise Tools definitions for AgentShield Governance & Demonstration.
 *
 * Models real enterprise tool endpoints intercepted by AgentShield:
 * 1. Customer CRM (Customer deletion, update, lookup)
 * 2. Comms / Email Gateway (Bulk & single email sends)
 * 3. Knowledge Base (Internal documentation reads)
 * 4. Financial Ledger / Payment Gateway (Fund transfers, refunds)
 * 5. Infrastructure Cloud Ops (Container termination, server restart)
 * 6. Data Exporter (Sensitive data exports)
 */

export const MOCK_TOOLS = [
  {
    id: "customer_crm",
    name: "Customer CRM",
    description: "Enterprise customer relationship management system (Salesforce / HubSpot simulation)",
    category: "crm",
    version: "1.2.0",
    status: "online",
    operations: [
      {
        name: "delete_customers",
        description: "Bulk delete customer accounts and associated contact records",
        actionType: "delete",
        reversibility: "irreversible",
        defaultRisk: "CRITICAL",
        parameters: {
          customerIds: { type: "array", items: "string", description: "List of customer UUIDs or IDs to delete" },
          count: { type: "number", description: "Count of customer records affected" },
          reason: { type: "string", description: "Operational reason for deletion" },
        },
        async handler(params = {}) {
          const count = params.count || (Array.isArray(params.customerIds) ? params.customerIds.length : 1);
          return {
            success: true,
            operation: "delete_customers",
            affectedCount: count,
            recordsDeleted: params.customerIds || [`cust_${Math.floor(Math.random() * 9000 + 1000)}`],
            timestamp: new Date().toISOString(),
          };
        },
      },
      {
        name: "update_customer",
        description: "Update customer details, metadata, and communication preferences",
        actionType: "write",
        reversibility: "reversible",
        defaultRisk: "MEDIUM",
        parameters: {
          customerId: { type: "string", required: true },
          updates: { type: "object", required: true },
        },
        async handler(params = {}) {
          return {
            success: true,
            operation: "update_customer",
            customerId: params.customerId || "cust_1001",
            updatedFields: Object.keys(params.updates || {}),
            timestamp: new Date().toISOString(),
          };
        },
      },
      {
        name: "get_customer",
        description: "Retrieve customer profile and purchase history",
        actionType: "read",
        reversibility: "reversible",
        defaultRisk: "LOW",
        parameters: {
          customerId: { type: "string", required: true },
        },
        async handler(params = {}) {
          return {
            success: true,
            operation: "get_customer",
            customer: {
              id: params.customerId || "cust_1001",
              name: "Acme Corp Lead",
              tier: "Enterprise",
              status: "Active",
            },
            timestamp: new Date().toISOString(),
          };
        },
      },
    ],
  },
  {
    id: "email_sender",
    name: "Comms & Email Gateway",
    description: "External customer email dispatch and notification service (SendGrid / Postmark simulation)",
    category: "communication",
    version: "2.0.1",
    status: "online",
    operations: [
      {
        name: "send_emails",
        description: "Dispatch outreach, follow-up, or notification emails to external recipients",
        actionType: "send",
        reversibility: "irreversible",
        defaultRisk: "HIGH",
        destination: { type: "external", name: "External Recipient Gateway" },
        parameters: {
          recipients: { type: "array", items: "string", description: "Recipient email addresses" },
          count: { type: "number", description: "Number of emails to send" },
          subject: { type: "string", description: "Email subject line" },
          template: { type: "string", description: "Email template name" },
        },
        async handler(params = {}) {
          const count = params.count || (Array.isArray(params.recipients) ? params.recipients.length : 1);
          return {
            success: true,
            operation: "send_emails",
            dispatchedCount: count,
            sampleRecipients: (params.recipients || ["lead@acme.com"]).slice(0, 3),
            messageId: `msg_${Math.random().toString(36).substring(2, 11)}`,
            timestamp: new Date().toISOString(),
          };
        },
      },
    ],
  },
  {
    id: "knowledge_base",
    name: "Internal Knowledge Base",
    description: "Internal documentation, runbooks, and product knowledge repository (Notion / Confluence simulation)",
    category: "knowledge",
    version: "1.0.0",
    status: "online",
    operations: [
      {
        name: "read_articles",
        description: "Read internal guides, security policies, and standard operating procedures",
        actionType: "read",
        reversibility: "reversible",
        defaultRisk: "LOW",
        parameters: {
          articleIds: { type: "array", items: "string" },
          query: { type: "string" },
          count: { type: "number" },
        },
        async handler(params = {}) {
          const count = params.count || (Array.isArray(params.articleIds) ? params.articleIds.length : 1);
          return {
            success: true,
            operation: "read_articles",
            articlesRead: count,
            articles: [
              { id: "kb_101", title: "Enterprise Governance Protocols", category: "Security" },
              { id: "kb_102", title: "Incident Response Playbook", category: "Operations" },
            ].slice(0, count),
            timestamp: new Date().toISOString(),
          };
        },
      },
    ],
  },
  {
    id: "financial_ledger",
    name: "Financial Ledger & Stripe Gateway",
    description: "Financial transactions, payment disbursements, and ledger operations",
    category: "finance",
    version: "3.1.0",
    status: "online",
    operations: [
      {
        name: "transfer_funds",
        description: "Execute wire or payment transfer to target account",
        actionType: "send",
        reversibility: "partially_reversible",
        defaultRisk: "HIGH",
        parameters: {
          amount: { type: "number", required: true, description: "Transfer amount in USD" },
          recipientAccount: { type: "string", required: true },
          currency: { type: "string", default: "USD" },
        },
        async handler(params = {}) {
          return {
            success: true,
            operation: "transfer_funds",
            transferId: `txn_${Math.random().toString(36).substring(2, 12)}`,
            amount: params.amount || 100,
            currency: params.currency || "USD",
            recipient: params.recipientAccount || "acct_dest_9918",
            timestamp: new Date().toISOString(),
          };
        },
      },
      {
        name: "issue_refund",
        description: "Refund previous charge back to customer payment method",
        actionType: "write",
        reversibility: "reversible",
        defaultRisk: "MEDIUM",
        parameters: {
          chargeId: { type: "string", required: true },
          amount: { type: "number", required: true },
        },
        async handler(params = {}) {
          return {
            success: true,
            operation: "issue_refund",
            refundId: `ref_${Math.random().toString(36).substring(2, 10)}`,
            chargeId: params.chargeId || "ch_12345",
            amount: params.amount || 50,
            timestamp: new Date().toISOString(),
          };
        },
      },
    ],
  },
  {
    id: "infrastructure_ops",
    name: "Cloud Infrastructure (AWS / K8s)",
    description: "Cloud compute, Kubernetes workload, and firewall provisioning controls",
    category: "infrastructure",
    version: "1.5.0",
    status: "online",
    operations: [
      {
        name: "terminate_instance",
        description: "Permanently terminate a cloud server instance or cluster node",
        actionType: "delete",
        reversibility: "irreversible",
        defaultRisk: "CRITICAL",
        parameters: {
          instanceId: { type: "string", required: true },
          environment: { type: "string", enum: ["development", "staging", "production"] },
        },
        async handler(params = {}) {
          return {
            success: true,
            operation: "terminate_instance",
            instanceId: params.instanceId || "i-09f83a21bc456",
            environment: params.environment || "production",
            status: "terminated",
            timestamp: new Date().toISOString(),
          };
        },
      },
      {
        name: "restart_service",
        description: "Gracefully restart backend microservice container",
        actionType: "execute",
        reversibility: "reversible",
        defaultRisk: "MEDIUM",
        parameters: {
          serviceName: { type: "string", required: true },
        },
        async handler(params = {}) {
          return {
            success: true,
            operation: "restart_service",
            serviceName: params.serviceName || "api-gateway",
            status: "restarted",
            timestamp: new Date().toISOString(),
          };
        },
      },
    ],
  },
  {
    id: "data_exporter",
    name: "Sensitive Data Exporter",
    description: "Customer personal data, financial export, and database dump utility",
    category: "data",
    version: "1.0.0",
    status: "online",
    operations: [
      {
        name: "export_customer_data",
        description: "Export customer records, PII, and financial transaction logs",
        actionType: "export",
        reversibility: "irreversible",
        defaultRisk: "CRITICAL",
        parameters: {
          dataType: { type: "string", enum: ["pii", "financial", "crm"] },
          destination: { type: "string", description: "Export destination URL or S3 bucket" },
          recordsCount: { type: "number" },
        },
        async handler(params = {}) {
          return {
            success: true,
            operation: "export_customer_data",
            dataType: params.dataType || "pii",
            recordsExported: params.recordsCount || 500,
            destination: params.destination || "s3://secure-exports/dump.csv",
            timestamp: new Date().toISOString(),
          };
        },
      },
    ],
  },
];
