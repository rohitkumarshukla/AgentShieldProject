-- =====================================================================
-- AgentShield Row-Level Security (RLS) & Access Policies
-- Migration: 0004_rls_policies.sql
-- =====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE IF EXISTS agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_events ENABLE ROW LEVEL SECURITY;

-- 2. Allow backend service and authenticated API access for agents table
DROP POLICY IF EXISTS "Allow all access to agents" ON agents;
CREATE POLICY "Allow all access to agents" ON agents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Allow all access to actions table
DROP POLICY IF EXISTS "Allow all access to actions" ON actions;
CREATE POLICY "Allow all access to actions" ON actions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Allow all access to decisions table
DROP POLICY IF EXISTS "Allow all access to decisions" ON decisions;
CREATE POLICY "Allow all access to decisions" ON decisions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Allow all access to approvals table
DROP POLICY IF EXISTS "Allow all access to approvals" ON approvals;
CREATE POLICY "Allow all access to approvals" ON approvals
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. Allow all access to audit_events table
DROP POLICY IF EXISTS "Allow all access to audit_events" ON audit_events;
CREATE POLICY "Allow all access to audit_events" ON audit_events
    FOR ALL
    USING (true)
    WITH CHECK (true);
