-- Store only a one-way digest of each agent API key. Existing agents remain
-- valid records but must receive a key before key-based authentication is used.
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
