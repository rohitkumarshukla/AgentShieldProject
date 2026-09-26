-- =====================================================================
-- AgentShield Core Security & Governance Schema
-- Migration: 0001_core_schema.sql
-- =====================================================================
-- Architecture:
--   agents (registered AI agents subject to governance & auth)
--     ↓
--   actions (proposed operations evaluated before tool invocation)
--     ↓
--   decisions (authoritative risk assessment + policy evaluation result)
--     ↓
--   approvals (human authorization queue for approval-gated actions)
--     ↓
--   audit_events (immutable audit log capturing the security determination)
--
-- Security Design:
-- - Uses PostgreSQL gen_random_uuid() for collision-resistant UUIDs.
-- - Rejects cascading deletes (RESTRICT) on security-critical audit trails.
-- - Enforces strict domain invariants using CHECK constraints.
-- - Stores cryptographic API key hashes for agent authentication.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. agents
-- Stores AI agents governed by AgentShield.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    environment TEXT NOT NULL DEFAULT 'development',
    api_key_hash TEXT UNIQUE,
    api_key_prefix TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_agents_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_agents_environment CHECK (environment IN ('development', 'staging', 'production'))
);

COMMENT ON TABLE agents IS 'AI agents governed by AgentShield';
COMMENT ON COLUMN agents.id IS 'Primary identifier for the governed agent';
COMMENT ON COLUMN agents.status IS 'Operational status of the agent (active, inactive)';
COMMENT ON COLUMN agents.environment IS 'Deployment environment the agent operates in';
COMMENT ON COLUMN agents.api_key_hash IS 'SHA-256 hash of the agent secret key for API authentication';
COMMENT ON COLUMN agents.api_key_prefix IS 'Key prefix (e.g. ash_live_...) for key identification';

-- ---------------------------------------------------------------------
-- 2. actions
-- Stores proposed tool operations submitted to AgentShield for evaluation.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    target TEXT NOT NULL,
    description TEXT NOT NULL,
    scope JSONB NOT NULL,
    destination JSONB NOT NULL,
    environment TEXT NOT NULL,
    sensitivity JSONB NOT NULL,
    financial_impact NUMERIC(15, 2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_actions_agent FOREIGN KEY (agent_id)
        REFERENCES agents (id) ON DELETE RESTRICT,

    CONSTRAINT chk_actions_action_type CHECK (action_type IN ('read', 'write', 'delete', 'send', 'execute', 'export')),
    CONSTRAINT chk_actions_environment CHECK (environment IN ('development', 'staging', 'production')),
    CONSTRAINT chk_actions_financial_impact CHECK (financial_impact >= 0)
);

COMMENT ON TABLE actions IS 'Actions submitted to AgentShield for security evaluation';
COMMENT ON COLUMN actions.agent_id IS 'Foreign key to the agent requesting this action';
COMMENT ON COLUMN actions.action_type IS 'Operation type (read, write, delete, send, execute, export)';
COMMENT ON COLUMN actions.scope IS 'JSONB describing target volume and count ({type: single|bulk|all, count: number})';
COMMENT ON COLUMN actions.destination IS 'JSONB describing data destination boundary ({type: internal|external|none, value: string|null})';
COMMENT ON COLUMN actions.sensitivity IS 'JSONB describing data classification ({level: public|internal|sensitive|restricted})';

-- ---------------------------------------------------------------------
-- 3. decisions
-- Stores evaluation results computed by Risk Engine + Policy Engine.
-- One action produces exactly one authoritative decision record.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    policy_decision TEXT NOT NULL,
    policy_code TEXT NOT NULL,
    policy_reason TEXT NOT NULL,
    requires_human_approval BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_decisions_action_id UNIQUE (action_id),

    CONSTRAINT fk_decisions_action FOREIGN KEY (action_id)
        REFERENCES actions (id) ON DELETE RESTRICT,

    CONSTRAINT chk_decisions_risk_score CHECK (risk_score >= 0 AND risk_score <= 100),
    CONSTRAINT chk_decisions_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_decisions_policy_decision CHECK (policy_decision IN ('ALLOW', 'APPROVAL_REQUIRED', 'BLOCK'))
);

COMMENT ON TABLE decisions IS 'Authoritative risk assessments and policy decisions for actions';
COMMENT ON COLUMN decisions.action_id IS 'Unique foreign key to the evaluated action';
COMMENT ON COLUMN decisions.risk_score IS 'Calculated numeric risk score (0 to 100)';
COMMENT ON COLUMN decisions.risk_level IS 'Qualitative risk rating (LOW, MEDIUM, HIGH, CRITICAL)';
COMMENT ON COLUMN decisions.policy_decision IS 'Final governance decision (ALLOW, APPROVAL_REQUIRED, BLOCK)';

-- ---------------------------------------------------------------------
-- 4. policies
-- Governance policy catalog evaluated by the Policy Engine.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    action_outcome TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    precedence INTEGER NOT NULL DEFAULT 100,
    condition_expression TEXT NOT NULL,
    requires_human_approval BOOLEAN NOT NULL DEFAULT false,
    approver_role TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_policies_action_outcome CHECK (action_outcome IN ('ALLOW', 'APPROVAL_REQUIRED', 'BLOCK'))
);

COMMENT ON TABLE policies IS 'Catalog of deterministic security governance policies';
COMMENT ON COLUMN policies.id IS 'Policy identifier code (e.g. bulk_delete_guard)';
COMMENT ON COLUMN policies.action_outcome IS 'Outcome when policy matches (ALLOW, APPROVAL_REQUIRED, BLOCK)';
COMMENT ON COLUMN policies.precedence IS 'Evaluation precedence (lower number = higher precedence)';

-- ---------------------------------------------------------------------
-- 5. approvals
-- Human review requests for actions requiring authorization before execution.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    approver_role TEXT,
    reviewed_by TEXT,
    review_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,

    CONSTRAINT fk_approvals_action FOREIGN KEY (action_id)
        REFERENCES actions (id) ON DELETE RESTRICT,

    CONSTRAINT chk_approvals_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'))
);

COMMENT ON TABLE approvals IS 'Human review requests for approval-gated actions';
COMMENT ON COLUMN approvals.action_id IS 'Action pending or resolved through human authorization';
COMMENT ON COLUMN approvals.status IS 'Review state (PENDING, APPROVED, REJECTED, EXPIRED)';

-- ---------------------------------------------------------------------
-- 6. audit_events
-- Security audit record capturing the end-to-end evaluation trace.
-- Immutable record: ON DELETE RESTRICT protects audit historical integrity.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    target TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    policy_decision TEXT NOT NULL,
    policy_code TEXT NOT NULL,
    policy_reason TEXT NOT NULL,
    requires_human_approval BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_events_action FOREIGN KEY (action_id)
        REFERENCES actions (id) ON DELETE RESTRICT,

    CONSTRAINT fk_audit_events_agent FOREIGN KEY (agent_id)
        REFERENCES agents (id) ON DELETE RESTRICT,

    CONSTRAINT chk_audit_events_action_type CHECK (action_type IN ('read', 'write', 'delete', 'send', 'execute', 'export')),
    CONSTRAINT chk_audit_events_risk_score CHECK (risk_score >= 0 AND risk_score <= 100),
    CONSTRAINT chk_audit_events_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_audit_events_policy_decision CHECK (policy_decision IN ('ALLOW', 'APPROVAL_REQUIRED', 'BLOCK')),
    CONSTRAINT chk_audit_events_status CHECK (status IN (
        'DECISION_MADE',
        'AWAITING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'EXECUTED',
        'BLOCKED',
        'FAILED'
    ))
);

COMMENT ON TABLE audit_events IS 'Immutable security audit events generated by AgentShield pipeline';
COMMENT ON COLUMN audit_events.status IS 'Lifecycle state: DECISION_MADE, AWAITING_APPROVAL, BLOCKED, APPROVED, REJECTED, EXECUTED, FAILED';

-- ---------------------------------------------------------------------
-- INDEXES
-- Optimized for timeline ordering, agent filtering, and status lookups.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_environment ON agents (environment);
CREATE INDEX IF NOT EXISTS idx_agents_api_key_hash ON agents (api_key_hash);

CREATE INDEX IF NOT EXISTS idx_actions_agent_id ON actions (agent_id);
CREATE INDEX IF NOT EXISTS idx_actions_created_at ON actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_action_type ON actions (action_type);

CREATE INDEX IF NOT EXISTS idx_decisions_action_id ON decisions (action_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_risk_level ON decisions (risk_level);
CREATE INDEX IF NOT EXISTS idx_decisions_policy_decision ON decisions (policy_decision);

CREATE INDEX IF NOT EXISTS idx_policies_is_active ON policies (is_active);
CREATE INDEX IF NOT EXISTS idx_policies_precedence ON policies (precedence ASC);

CREATE INDEX IF NOT EXISTS idx_approvals_action_id ON approvals (action_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals (status);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_action_id ON audit_events (action_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_agent_id ON audit_events (agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_status ON audit_events (status);
