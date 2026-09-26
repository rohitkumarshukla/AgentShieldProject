-- =====================================================================
-- AgentShield Seed Data Script
-- File: seed.schema.sql
-- Description:
--   Populates the AgentShield core governance schema (0001_core_schema.sql)
--   with realistic, mathematically verified data matching the Risk Engine,
--   Policy Engine, and UI dashboard requirements.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Clean Existing Data (Idempotent execution)
-- ---------------------------------------------------------------------
TRUNCATE TABLE audit_events, approvals, decisions, actions, policies, agents RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- 1. Agents
-- Governed AI agents across development, staging, and production.
-- Includes cryptographic API key hashes for agent authentication.
-- ---------------------------------------------------------------------
INSERT INTO agents (id, name, description, status, environment, api_key_hash, api_key_prefix, metadata, created_at, updated_at)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        'CRM Cleanup Agent',
        'Automated CRM maintenance agent managing duplicate records, lead enrichment, and hygiene.',
        'active',
        'production',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'ash_live_crm',
        '{
            "slug": "crm-cleanup-agent",
            "identity": "crm-agent@agentshield.internal",
            "version": "2.4.1",
            "tools": ["CRM.deleteCustomers", "CRM.updateBatch", "CRM.queryRecords", "CRM.exportData"],
            "owner": "Sales Operations",
            "risk_profile": "HIGH"
        }'::jsonb,
        NOW() - INTERVAL '14 days',
        NOW() - INTERVAL '1 hour'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        'Sales Outreach Agent',
        'Outbound communications agent managing automated lead follow-ups and marketing newsletters.',
        'active',
        'production',
        '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        'ash_live_sales',
        '{
            "slug": "sales-outreach-agent",
            "identity": "sales-agent@agentshield.internal",
            "version": "1.8.0",
            "tools": ["Email.sendBatch", "Email.send", "CRM.queryRecords", "Email.verifyDeliverability"],
            "owner": "Growth Marketing",
            "risk_profile": "MEDIUM"
        }'::jsonb,
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '2 hours'
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        'DevOps Automation Agent',
        'Infrastructure automation agent monitoring microservices, ingress gateways, and cluster scaling.',
        'active',
        'production',
        '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        'ash_live_devops',
        '{
            "slug": "devops-agent",
            "identity": "devops-agent@agentshield.internal",
            "version": "3.1.2",
            "tools": ["Infrastructure.restart", "Infrastructure.scale", "Logs.read", "Cluster.snapshot"],
            "owner": "Platform Engineering",
            "risk_profile": "CRITICAL"
        }'::jsonb,
        NOW() - INTERVAL '45 days',
        NOW() - INTERVAL '30 minutes'
    ),
    (
        '40000000-0000-0000-0000-000000000004',
        'Research & Knowledge Agent',
        'Autonomous knowledge base curator fetching documentation, answering internal technical queries.',
        'active',
        'development',
        'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
        'ash_dev_research',
        '{
            "slug": "research-agent",
            "identity": "research-agent@agentshield.internal",
            "version": "1.2.0",
            "tools": ["KnowledgeBase.read", "Web.search", "VectorStore.query"],
            "owner": "AI R&D",
            "risk_profile": "LOW"
        }'::jsonb,
        NOW() - INTERVAL '60 days',
        NOW() - INTERVAL '4 hours'
    ),
    (
        '50000000-0000-0000-0000-000000000005',
        'Finance Reconciliation Agent',
        'Autonomous ledger agent processing invoices, dispute adjustments, and transaction reconciliations.',
        'active',
        'production',
        '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
        'ash_live_finance',
        '{
            "slug": "finance-agent",
            "identity": "finance-agent@agentshield.internal",
            "version": "2.0.3",
            "tools": ["Payment.refund", "Payment.query", "Reports.generate", "Ledger.reconcile"],
            "owner": "Finance Operations",
            "risk_profile": "HIGH"
        }'::jsonb,
        NOW() - INTERVAL '20 days',
        NOW() - INTERVAL '15 minutes'
    ),
    (
        '60000000-0000-0000-0000-000000000006',
        'Customer Support Bot (Legacy)',
        'Deprecated support assistant bot formerly used for answering general customer support inquiries.',
        'inactive',
        'staging',
        'ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae',
        'ash_stg_support',
        '{
            "slug": "legacy-support-bot",
            "identity": "support-legacy@agentshield.internal",
            "version": "0.9.5",
            "tools": ["Tickets.read", "Tickets.reply"],
            "owner": "Customer Support",
            "risk_profile": "LOW",
            "deactivation_reason": "Migrated to Gen2 support model"
        }'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '10 days'
    );

-- ---------------------------------------------------------------------
-- 2. Policies
-- Formal catalog of deterministic security governance policies.
-- ---------------------------------------------------------------------
INSERT INTO policies (id, name, description, action_outcome, is_active, precedence, condition_expression, requires_human_approval, approver_role, metadata, created_at, updated_at)
VALUES
    (
        'bulk_delete_guard',
        'Bulk Deletion Guard',
        'Blocks large-scale deletions (>=100 items) to prevent catastrophic data loss.',
        'BLOCK',
        true,
        1,
        'action.action_type == "delete" && action.scope.count >= 100',
        false,
        NULL,
        '{"category": "data_integrity", "reversible": false}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    ),
    (
        'critical_risk_block',
        'Critical Risk Auto-Block',
        'Critical-risk actions are blocked automatically to protect system integrity.',
        'BLOCK',
        true,
        2,
        'risk.level == "CRITICAL"',
        false,
        NULL,
        '{"category": "system_protection"}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    ),
    (
        'external_email_review',
        'External Communication Review',
        'Outbound communications to external destinations at HIGH risk require explicit human review.',
        'APPROVAL_REQUIRED',
        true,
        3,
        'action.action_type == "send" && action.destination.type == "external" && risk.level == "HIGH"',
        true,
        'security_admin',
        '{"category": "communication_security"}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    ),
    (
        'high_risk_human_approval',
        'High Risk Human Authorization',
        'High-risk actions require human authorization before execution.',
        'APPROVAL_REQUIRED',
        true,
        4,
        'risk.level == "HIGH"',
        true,
        'team_lead',
        '{"category": "human_governance"}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    ),
    (
        'financial_threshold',
        'Financial Transaction Threshold',
        'Financial transactions exceeding ₹10,000 require finance administrator approval.',
        'APPROVAL_REQUIRED',
        true,
        5,
        'action.financial_impact >= 10000',
        true,
        'finance_admin',
        '{"category": "financial_controls"}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    ),
    (
        'infra_change_review',
        'Production Infrastructure Review',
        'Infrastructure mutations and restarts in production environments require ops review.',
        'APPROVAL_REQUIRED',
        true,
        6,
        'action.environment == "production" && action.action_type == "execute"',
        true,
        'ops_admin',
        '{"category": "infrastructure_safety"}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    ),
    (
        'sensitive_export_guard',
        'Sensitive Data Export Guard',
        'Blocks or restricts bulk exports containing sensitive customer or financial PII.',
        'APPROVAL_REQUIRED',
        true,
        7,
        'action.action_type == "export" && action.sensitivity.level == "sensitive"',
        true,
        'compliance_admin',
        '{"category": "compliance_privacy"}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    ),
    (
        'standard_risk_allow',
        'Standard Risk Automatic Execution',
        'Low and medium risk actions operate within the automatic execution risk threshold.',
        'ALLOW',
        true,
        100,
        'risk.level == "LOW" || risk.level == "MEDIUM"',
        false,
        NULL,
        '{"category": "operational_efficiency"}'::jsonb,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    );

-- ---------------------------------------------------------------------
-- 3. Actions
-- Proposed agent actions spanning all types (read, write, delete, send, execute, export).
-- ---------------------------------------------------------------------
INSERT INTO actions (id, agent_id, action_type, target, description, scope, destination, environment, sensitivity, financial_impact, metadata, created_at)
VALUES
    -- Action 1: CRM bulk deletion (Catastrophic Risk - Blocked)
    (
        'a0000001-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'delete',
        'customers',
        'Purge 147 inactive customer profile records from production database',
        '{"type": "bulk", "count": 147}'::jsonb,
        '{"type": "internal", "value": "postgres://crm_db/customers"}'::jsonb,
        'production',
        '{"level": "sensitive"}'::jsonb,
        0.00,
        '{
            "tool": "CRM.deleteCustomers",
            "requested_by": "crm_cron_worker",
            "reversible": "Irreversible",
            "data_classification": "PII / Sensitive"
        }'::jsonb,
        NOW() - INTERVAL '2 hours'
    ),

    -- Action 2: Sales outbound email batch (High Risk - External Comms - Awaiting Review)
    (
        'a0000002-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        'send',
        'lead_contacts',
        'Dispatch Q3 enterprise product webinar invitation to 38 external sales leads',
        '{"type": "bulk", "count": 38}'::jsonb,
        '{"type": "external", "value": "smtp://mailgun.org"}'::jsonb,
        'production',
        '{"level": "internal"}'::jsonb,
        0.00,
        '{
            "tool": "Email.sendBatch",
            "campaign_id": "camp_2026_q3_webinar",
            "reversible": "Partially Reversible",
            "data_classification": "Internal / Lead Data"
        }'::jsonb,
        NOW() - INTERVAL '1 hour 45 minutes'
    ),

    -- Action 3: Finance refund authorization (High Risk - Financial - Approved & Executed)
    (
        'a0000003-0000-0000-0000-000000000003',
        '50000000-0000-0000-0000-000000000005',
        'execute',
        'payments/refunds',
        'Authorize merchant dispute reimbursement refund of ₹15,200 for customer claim #4912',
        '{"type": "single", "count": 1}'::jsonb,
        '{"type": "internal", "value": "payment_service_core"}'::jsonb,
        'production',
        '{"level": "internal"}'::jsonb,
        15200.00,
        '{
            "tool": "Payment.refund",
            "claim_id": "CLM-4912-IN",
            "currency": "INR",
            "reversible": "Partially Reversible",
            "data_classification": "Financial"
        }'::jsonb,
        NOW() - INTERVAL '1 hour 30 minutes'
    ),

    -- Action 4: DevOps service restart (High Risk - Production Infrastructure - Rejected)
    (
        'a0000004-0000-0000-0000-000000000004',
        '30000000-0000-0000-0000-000000000003',
        'execute',
        'k8s/deployments/api-gateway',
        'Trigger zero-downtime rolling restart on 30 pods of production api-gateway',
        '{"type": "bulk", "count": 30}'::jsonb,
        '{"type": "none", "value": null}'::jsonb,
        'production',
        '{"level": "internal"}'::jsonb,
        0.00,
        '{
            "tool": "Infrastructure.restart",
            "cluster": "k8s-prod-primary",
            "reversible": "Reversible",
            "data_classification": "Infrastructure"
        }'::jsonb,
        NOW() - INTERVAL '1 hour 15 minutes'
    ),

    -- Action 5: DevOps snapshot deletion (Critical Risk - Integrity Guard Blocked)
    (
        'a0000005-0000-0000-0000-000000000005',
        '30000000-0000-0000-0000-000000000003',
        'delete',
        'backup/snapshots/pg-audit-log',
        'Prune 15 production audit log and transaction WAL snapshot archives',
        '{"type": "bulk", "count": 15}'::jsonb,
        '{"type": "none", "value": null}'::jsonb,
        'production',
        '{"level": "restricted"}'::jsonb,
        0.00,
        '{
            "tool": "Cluster.snapshot.delete",
            "reversible": "Irreversible",
            "data_classification": "Restricted / Security Logs"
        }'::jsonb,
        NOW() - INTERVAL '1 hour'
    ),

    -- Action 6: Research knowledge base read (Low Risk - Auto Allowed & Executed)
    (
        'a0000006-0000-0000-0000-000000000006',
        '40000000-0000-0000-0000-000000000004',
        'read',
        'kb/articles/auth-flow',
        'Fetch 5 reference architecture articles on OAuth2 and PKCE authorization protocols',
        '{"type": "bulk", "count": 5}'::jsonb,
        '{"type": "internal", "value": "notion_kb_sync"}'::jsonb,
        'development',
        '{"level": "public"}'::jsonb,
        0.00,
        '{
            "tool": "KnowledgeBase.read",
            "reversible": "Reversible",
            "data_classification": "Public"
        }'::jsonb,
        NOW() - INTERVAL '45 minutes'
    ),

    -- Action 7: CRM customer status update (Medium Risk - Standard Allowed & Executed)
    (
        'a0000007-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000001',
        'write',
        'customers/tags',
        'Batch update lead qualification status tags for 15 inbound prospects in staging',
        '{"type": "bulk", "count": 15}'::jsonb,
        '{"type": "internal", "value": "postgres://staging_crm/customers"}'::jsonb,
        'staging',
        '{"level": "internal"}'::jsonb,
        0.00,
        '{
            "tool": "CRM.updateBatch",
            "batch_id": "BATCH-202609-001",
            "reversible": "Reversible",
            "data_classification": "CRM Data"
        }'::jsonb,
        NOW() - INTERVAL '30 minutes'
    ),

    -- Action 8: Export sensitive lead contacts (High Risk - Awaiting Approval)
    (
        'a0000008-0000-0000-0000-000000000008',
        '10000000-0000-0000-0000-000000000001',
        'export',
        'reports/lead-contacts',
        'Export CSV containing contact details and phone numbers for 30 high-priority leads',
        '{"type": "bulk", "count": 30}'::jsonb,
        '{"type": "none", "value": null}'::jsonb,
        'development',
        '{"level": "sensitive"}'::jsonb,
        0.00,
        '{
            "tool": "CRM.exportData",
            "format": "csv",
            "reversible": "Partially Reversible",
            "data_classification": "PII / Sensitive"
        }'::jsonb,
        NOW() - INTERVAL '15 minutes'
    );

-- ---------------------------------------------------------------------
-- 4. Decisions
-- Authoritative risk evaluation and policy outcomes generated by engines.
-- Exactly 1 authoritative decision per action.
-- ---------------------------------------------------------------------
INSERT INTO decisions (id, action_id, risk_score, risk_level, risk_factors, policy_decision, policy_code, policy_reason, requires_human_approval, metadata, created_at)
VALUES
    -- Decision 1 for Action 1 (Bulk Delete -> BLOCK)
    -- Factors: Destructive(50) + Bulk>=100(55) + Sensitive(20) + Prod(15) = 140 -> Clamped 100 (CRITICAL)
    (
        'd0000001-0000-0000-0000-000000000001',
        'a0000001-0000-0000-0000-000000000001',
        100,
        'CRITICAL',
        '[
            {"code": "DESTRUCTIVE_ACTION", "description": "Delete action is inherently destructive", "points": 50},
            {"code": "BULK_SCOPE_CRITICAL", "description": "Action affects 100 or more resources", "points": 55},
            {"code": "SENSITIVE_DATA", "description": "Action involves sensitive or restricted data", "points": 20},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'BLOCK',
        'bulk_delete_guard',
        'Large-scale deletion is blocked to prevent destructive bulk operations',
        false,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 3.8
        }'::jsonb,
        NOW() - INTERVAL '2 hours'
    ),

    -- Decision 2 for Action 2 (External Send High Risk -> APPROVAL_REQUIRED)
    -- Factors: Bulk>=25(35) + External(20) + Prod(15) = 70 (HIGH)
    (
        'd0000002-0000-0000-0000-000000000002',
        'a0000002-0000-0000-0000-000000000002',
        70,
        'HIGH',
        '[
            {"code": "BULK_SCOPE_HIGH", "description": "Action affects 25 or more resources", "points": 35},
            {"code": "EXTERNAL_DESTINATION", "description": "Action sends data or performs an operation outside the internal environment", "points": 20},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'external_email_review',
        'External communication at high risk requires human review',
        true,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 2.4
        }'::jsonb,
        NOW() - INTERVAL '1 hour 45 minutes'
    ),

    -- Decision 3 for Action 3 (Financial High Risk -> APPROVAL_REQUIRED)
    -- Factors: Financial>=10000(35) + Prod(15) = 50 (HIGH)
    (
        'd0000003-0000-0000-0000-000000000003',
        'a0000003-0000-0000-0000-000000000003',
        50,
        'HIGH',
        '[
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15},
            {"code": "FINANCIAL_IMPACT_CRITICAL", "description": "Action has a financial impact of ₹10,000 or more", "points": 35}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'high_risk_human_approval',
        'High-risk actions require human approval before execution',
        true,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 2.9
        }'::jsonb,
        NOW() - INTERVAL '1 hour 30 minutes'
    ),

    -- Decision 4 for Action 4 (DevOps Infra Restart -> APPROVAL_REQUIRED)
    -- Factors: Bulk>=25(35) + Prod(15) = 50 (HIGH)
    (
        'd0000004-0000-0000-0000-000000000004',
        'a0000004-0000-0000-0000-000000000004',
        50,
        'HIGH',
        '[
            {"code": "BULK_SCOPE_HIGH", "description": "Action affects 25 or more resources", "points": 35},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'high_risk_human_approval',
        'High-risk actions require human approval before execution',
        true,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 3.1
        }'::jsonb,
        NOW() - INTERVAL '1 hour 15 minutes'
    ),

    -- Decision 5 for Action 5 (Snapshot Deletion -> BLOCK)
    -- Factors: Destructive(50) + Bulk>=10(20) + Sensitive/Restricted(20) + Prod(15) = 105 -> Clamped 100 (CRITICAL)
    (
        'd0000005-0000-0000-0000-000000000005',
        'a0000005-0000-0000-0000-000000000005',
        100,
        'CRITICAL',
        '[
            {"code": "DESTRUCTIVE_ACTION", "description": "Delete action is inherently destructive", "points": 50},
            {"code": "BULK_SCOPE_MEDIUM", "description": "Action affects 10 or more resources", "points": 20},
            {"code": "SENSITIVE_DATA", "description": "Action involves sensitive or restricted data", "points": 20},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'BLOCK',
        'critical_risk_block',
        'Critical-risk actions are blocked automatically to protect system integrity',
        false,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 2.1
        }'::jsonb,
        NOW() - INTERVAL '1 hour'
    ),

    -- Decision 6 for Action 6 (Read Knowledge Base -> ALLOW)
    -- Factors: None triggered (Score 0, LOW)
    (
        'd0000006-0000-0000-0000-000000000006',
        'a0000006-0000-0000-0000-000000000006',
        0,
        'LOW',
        '[]'::jsonb,
        'ALLOW',
        'standard_risk_allow',
        'Action is within the automatic execution risk threshold',
        false,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 1.2
        }'::jsonb,
        NOW() - INTERVAL '45 minutes'
    ),

    -- Decision 7 for Action 7 (Customer Status Update -> ALLOW)
    -- Factors: Bulk>=10(20) = 20 (MEDIUM)
    (
        'd0000007-0000-0000-0000-000000000007',
        'a0000007-0000-0000-0000-000000000007',
        20,
        'MEDIUM',
        '[
            {"code": "BULK_SCOPE_MEDIUM", "description": "Action affects 10 or more resources", "points": 20}
        ]'::jsonb,
        'ALLOW',
        'standard_risk_allow',
        'Action is within the automatic execution risk threshold',
        false,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 1.9
        }'::jsonb,
        NOW() - INTERVAL '30 minutes'
    ),

    -- Decision 8 for Action 8 (Export Sensitive Data -> APPROVAL_REQUIRED)
    -- Factors: Bulk>=25(35) + Sensitive(20) = 55 (HIGH)
    (
        'd0000008-0000-0000-0000-000000000008',
        'a0000008-0000-0000-0000-000000000008',
        55,
        'HIGH',
        '[
            {"code": "BULK_SCOPE_HIGH", "description": "Action affects 25 or more resources", "points": 35},
            {"code": "SENSITIVE_DATA", "description": "Action involves sensitive or restricted data", "points": 20}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'high_risk_human_approval',
        'High-risk actions require human approval before execution',
        true,
        '{
            "engine_version": "1.0.0",
            "evaluation_time_ms": 2.5
        }'::jsonb,
        NOW() - INTERVAL '15 minutes'
    );

-- ---------------------------------------------------------------------
-- 5. Approvals
-- Human authorization requests for approval-gated actions.
-- ---------------------------------------------------------------------
INSERT INTO approvals (id, action_id, status, approver_role, reviewed_by, review_notes, metadata, created_at, resolved_at)
VALUES
    -- Approval for Action 2 (Outbound email - Pending review)
    (
        'b0000001-0000-0000-0000-000000000001',
        'a0000002-0000-0000-0000-000000000002',
        'PENDING',
        'security_admin',
        NULL,
        NULL,
        '{"assigned_queue": "security_ops", "recipients": 38}'::jsonb,
        NOW() - INTERVAL '1 hour 45 minutes',
        NULL
    ),

    -- Approval for Action 3 (Financial refund - Approved)
    (
        'b0000002-0000-0000-0000-000000000002',
        'a0000003-0000-0000-0000-000000000003',
        'APPROVED',
        'finance_admin',
        'finance_admin@agentshield.internal',
        'Verified customer claim documentation #4912 against merchant processor dispute record.',
        '{"approval_channel": "dashboard", "claim_verified": true}'::jsonb,
        NOW() - INTERVAL '1 hour 30 minutes',
        NOW() - INTERVAL '1 hour 25 minutes'
    ),

    -- Approval for Action 4 (DevOps restart - Rejected)
    (
        'b0000003-0000-0000-0000-000000000003',
        'a0000004-0000-0000-0000-000000000004',
        'REJECTED',
        'ops_admin',
        'ops_admin@agentshield.internal',
        'Scheduled maintenance window required; restart delayed to 02:00 UTC maintenance window.',
        '{"rejection_code": "POLICY_MAINTENANCE_WINDOW"}'::jsonb,
        NOW() - INTERVAL '1 hour 15 minutes',
        NOW() - INTERVAL '1 hour 10 minutes'
    ),

    -- Approval for Action 8 (Sensitive lead export - Pending review)
    (
        'b0000004-0000-0000-0000-000000000004',
        'a0000008-0000-0000-0000-000000000008',
        'PENDING',
        'compliance_admin',
        NULL,
        NULL,
        '{"assigned_queue": "compliance_ops", "pii_detected": true}'::jsonb,
        NOW() - INTERVAL '15 minutes',
        NULL
    );

-- ---------------------------------------------------------------------
-- 6. Audit Events
-- Immutable end-to-end security audit trail capturing lifecycle states.
-- ---------------------------------------------------------------------
INSERT INTO audit_events (id, action_id, agent_id, action_type, target, risk_score, risk_level, risk_factors, policy_decision, policy_code, policy_reason, requires_human_approval, status, metadata, created_at)
VALUES
    -- Audit Event 1: CRM Bulk Deletion BLOCKED
    (
        'e0000001-0000-0000-0000-000000000001',
        'a0000001-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'delete',
        'customers',
        100,
        'CRITICAL',
        '[
            {"code": "DESTRUCTIVE_ACTION", "description": "Delete action is inherently destructive", "points": 50},
            {"code": "BULK_SCOPE_CRITICAL", "description": "Action affects 100 or more resources", "points": 55},
            {"code": "SENSITIVE_DATA", "description": "Action involves sensitive or restricted data", "points": 20},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'BLOCK',
        'bulk_delete_guard',
        'Large-scale deletion is blocked to prevent destructive bulk operations',
        false,
        'BLOCKED',
        '{
            "execution_status": "Prevented",
            "reversible": "Irreversible",
            "prevented_at": "NOW()",
            "incident_severity": "SEV-1"
        }'::jsonb,
        NOW() - INTERVAL '2 hours'
    ),

    -- Audit Event 2: Sales Outbound Email AWAITING_APPROVAL
    (
        'e0000002-0000-0000-0000-000000000002',
        'a0000002-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        'send',
        'lead_contacts',
        70,
        'HIGH',
        '[
            {"code": "BULK_SCOPE_HIGH", "description": "Action affects 25 or more resources", "points": 35},
            {"code": "EXTERNAL_DESTINATION", "description": "Action sends data or performs an operation outside the internal environment", "points": 20},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'external_email_review',
        'External communication at high risk requires human review',
        true,
        'AWAITING_APPROVAL',
        '{
            "execution_status": "Pending Approval",
            "assigned_queue": "security_ops",
            "recipients_count": 38
        }'::jsonb,
        NOW() - INTERVAL '1 hour 45 minutes'
    ),

    -- Audit Event 3: Finance Refund APPROVED and EXECUTED
    (
        'e0000003-0000-0000-0000-000000000003',
        'a0000003-0000-0000-0000-000000000003',
        '50000000-0000-0000-0000-000000000005',
        'execute',
        'payments/refunds',
        50,
        'HIGH',
        '[
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15},
            {"code": "FINANCIAL_IMPACT_CRITICAL", "description": "Action has a financial impact of ₹10,000 or more", "points": 35}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'high_risk_human_approval',
        'High-risk actions require human approval before execution',
        true,
        'EXECUTED',
        '{
            "execution_status": "Executed",
            "approver": "finance_admin@agentshield.internal",
            "approved_at": "NOW() - INTERVAL ''1 hour 25 minutes''",
            "execution_reference": "TXN_REF_8921102"
        }'::jsonb,
        NOW() - INTERVAL '1 hour 30 minutes'
    ),

    -- Audit Event 4: DevOps Restart REJECTED
    (
        'e0000004-0000-0000-0000-000000000004',
        'a0000004-0000-0000-0000-000000000004',
        '30000000-0000-0000-0000-000000000003',
        'execute',
        'k8s/deployments/api-gateway',
        50,
        'HIGH',
        '[
            {"code": "BULK_SCOPE_HIGH", "description": "Action affects 25 or more resources", "points": 35},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'high_risk_human_approval',
        'High-risk actions require human approval before execution',
        true,
        'REJECTED',
        '{
            "execution_status": "Rejected",
            "reviewer": "ops_admin@agentshield.internal",
            "rejection_reason": "Scheduled maintenance window required; restart delayed to 02:00 UTC."
        }'::jsonb,
        NOW() - INTERVAL '1 hour 15 minutes'
    ),

    -- Audit Event 5: DevOps Snapshot Deletion BLOCKED
    (
        'e0000005-0000-0000-0000-000000000005',
        'a0000005-0000-0000-0000-000000000005',
        '30000000-0000-0000-0000-000000000003',
        'delete',
        'backup/snapshots/pg-audit-log',
        100,
        'CRITICAL',
        '[
            {"code": "DESTRUCTIVE_ACTION", "description": "Delete action is inherently destructive", "points": 50},
            {"code": "BULK_SCOPE_MEDIUM", "description": "Action affects 10 or more resources", "points": 20},
            {"code": "SENSITIVE_DATA", "description": "Action involves sensitive or restricted data", "points": 20},
            {"code": "PRODUCTION_ENVIRONMENT", "description": "Action targets the production environment", "points": 15}
        ]'::jsonb,
        'BLOCK',
        'critical_risk_block',
        'Critical-risk actions are blocked automatically to protect system integrity',
        false,
        'BLOCKED',
        '{
            "execution_status": "Prevented",
            "reversible": "Irreversible",
            "security_incident_ticket": "SEC-8041"
        }'::jsonb,
        NOW() - INTERVAL '1 hour'
    ),

    -- Audit Event 6: Research Read EXECUTED
    (
        'e0000006-0000-0000-0000-000000000006',
        'a0000006-0000-0000-0000-000000000006',
        '40000000-0000-0000-0000-000000000004',
        'read',
        'kb/articles/auth-flow',
        0,
        'LOW',
        '[]'::jsonb,
        'ALLOW',
        'standard_risk_allow',
        'Action is within the automatic execution risk threshold',
        false,
        'EXECUTED',
        '{
            "execution_status": "Executed",
            "latency_ms": 42,
            "read_records": 5
        }'::jsonb,
        NOW() - INTERVAL '45 minutes'
    ),

    -- Audit Event 7: CRM Update EXECUTED
    (
        'e0000007-0000-0000-0000-000000000007',
        'a0000007-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000001',
        'write',
        'customers/tags',
        20,
        'MEDIUM',
        '[
            {"code": "BULK_SCOPE_MEDIUM", "description": "Action affects 10 or more resources", "points": 20}
        ]'::jsonb,
        'ALLOW',
        'standard_risk_allow',
        'Action is within the automatic execution risk threshold',
        false,
        'EXECUTED',
        '{
            "execution_status": "Executed",
            "modified_rows": 15
        }'::jsonb,
        NOW() - INTERVAL '30 minutes'
    ),

    -- Audit Event 8: Export Sensitive Data AWAITING_APPROVAL
    (
        'e0000008-0000-0000-0000-000000000008',
        'a0000008-0000-0000-0000-000000000008',
        '10000000-0000-0000-0000-000000000001',
        'export',
        'reports/lead-contacts',
        55,
        'HIGH',
        '[
            {"code": "BULK_SCOPE_HIGH", "description": "Action affects 25 or more resources", "points": 35},
            {"code": "SENSITIVE_DATA", "description": "Action involves sensitive or restricted data", "points": 20}
        ]'::jsonb,
        'APPROVAL_REQUIRED',
        'high_risk_human_approval',
        'High-risk actions require human approval before execution',
        true,
        'AWAITING_APPROVAL',
        '{
            "execution_status": "Pending Approval",
            "assigned_queue": "compliance_ops"
        }'::jsonb,
        NOW() - INTERVAL '15 minutes'
    );

COMMIT;
