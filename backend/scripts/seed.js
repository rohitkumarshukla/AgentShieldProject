import { getSupabaseClient } from "../src/lib/supabase.js";

/**
 * MVP Live Presentation Agents & Scenarios Seed Script
 */
const MVP_AGENTS = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    name: "CRM Cleanup Agent",
    description: "Automated CRM maintenance agent managing duplicate records, lead enrichment, and hygiene.",
    status: "active",
    environment: "production",
    api_key_prefix: "ash_live_crm",
    metadata: {
      slug: "crm-cleanup-agent",
      role: "Maintenance Bot",
      owner: "Sales Operations",
      risk_profile: "HIGH",
      permissions: {
        allowedTools: ["customer_crm", "knowledge_base"],
        blockedOperations: [],
        maxFinancialLimit: null,
        requiresApprovalThreshold: 60,
        environmentRestrictions: ["production", "development"],
      },
      demo_scenario: {
        name: "Scenario 1: Destructive Bulk Delete (BLOCKED)",
        toolId: "customer_crm",
        operation: "bulkDeleteCustomers",
        parameters: { count: 147, filter: "inactive" },
        expectedDecision: "BLOCK",
        expectedRule: "bulk_delete_guard",
      },
    },
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    name: "Sales Outreach Agent",
    description: "Outbound communications agent managing automated lead follow-ups and marketing newsletters.",
    status: "active",
    environment: "production",
    api_key_prefix: "ash_live_sales",
    metadata: {
      slug: "sales-outreach-agent",
      role: "Growth Bot",
      owner: "Growth Marketing",
      risk_profile: "MEDIUM",
      permissions: {
        allowedTools: ["email_sender", "customer_crm", "knowledge_base"],
        blockedOperations: [],
        maxFinancialLimit: null,
        requiresApprovalThreshold: 50,
        environmentRestrictions: ["production", "staging", "development"],
      },
      demo_scenario: {
        name: "Scenario 2: Mass Outbound Email (APPROVAL REQUIRED)",
        toolId: "email_sender",
        operation: "bulkSendEmails",
        parameters: { recipientCount: 38, campaign: "Q3_Promo" },
        expectedDecision: "APPROVAL_REQUIRED",
        expectedRule: "external_email_review",
      },
    },
  },
  {
    id: "30000000-0000-0000-0000-000000000003",
    name: "DevOps Automation Agent",
    description: "Infrastructure automation agent monitoring microservices, ingress gateways, and cluster scaling.",
    status: "active",
    environment: "production",
    api_key_prefix: "ash_live_devops",
    metadata: {
      slug: "devops-agent",
      role: "Infra Bot",
      owner: "Platform Engineering",
      risk_profile: "CRITICAL",
      permissions: {
        allowedTools: ["infrastructure_ops", "knowledge_base"],
        blockedOperations: [],
        maxFinancialLimit: null,
        requiresApprovalThreshold: 60,
        environmentRestrictions: ["production", "staging", "development"],
      },
    },
  },
  {
    id: "40000000-0000-0000-0000-000000000004",
    name: "Research & Knowledge Agent",
    description: "Autonomous knowledge base curator fetching documentation, answering internal technical queries.",
    status: "active",
    environment: "development",
    api_key_prefix: "ash_dev_research",
    metadata: {
      slug: "research-agent",
      role: "R&D Bot",
      owner: "AI R&D",
      risk_profile: "LOW",
      permissions: {
        allowedTools: ["knowledge_base"],
        blockedOperations: [],
        maxFinancialLimit: null,
        requiresApprovalThreshold: 60,
        environmentRestrictions: ["development"],
      },
      demo_scenario: {
        name: "Scenario 3: Internal Knowledge Read (AUTO-ALLOWED)",
        toolId: "knowledge_base",
        operation: "queryDocuments",
        parameters: { query: "OAuth2 PKCE reference", limit: 12 },
        expectedDecision: "ALLOW",
        expectedRule: "internal_read_allow",
      },
    },
  },
];

async function seed() {
  console.log("=================================================");
  console.log("   AgentShield MVP Presentation Seed Script     ");
  console.log("=================================================");

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("❌ Supabase client is not configured. Check backend/.env file.");
    process.exit(1);
  }

  try {
    console.log("Upserting MVP presentation agents into Supabase...");

    for (const agent of MVP_AGENTS) {
      const { error } = await supabase
        .from("agents")
        .upsert(
          {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            status: agent.status,
            environment: agent.environment,
            metadata: agent.metadata,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (error) {
        console.warn(`  ⚠️ Could not upsert agent '${agent.name}': ${error.message}`);
      } else {
        console.log(`  ✅ Agent '${agent.name}' ready for live demo.`);
      }
    }

    console.log("\n-------------------------------------------------");
    console.log("✅ MVP presentation agents successfully configured!");
    console.log("-------------------------------------------------");
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
  }
}

seed();
