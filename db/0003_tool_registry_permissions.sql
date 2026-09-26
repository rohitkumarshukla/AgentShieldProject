-- Registered capabilities and explicit per-agent grants.
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    action_type TEXT NOT NULL,
    target TEXT,
    description TEXT,
    risk_tier TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tool_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents (id) ON DELETE RESTRICT,
    tool_id UUID NOT NULL REFERENCES tools (id) ON DELETE RESTRICT,
    max_scope TEXT,
    environments TEXT[],
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by TEXT,
    CONSTRAINT uq_agent_tool_permissions_agent_tool UNIQUE (agent_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_permissions_agent_id ON agent_tool_permissions (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_permissions_tool_id ON agent_tool_permissions (tool_id);
