import assert from "node:assert/strict";
import test from "node:test";

import { createSupabaseClient, getSupabaseClient, isSupabaseConfigured, supabase } from "./supabase.js";

test("TEST 1: When Supabase credentials are absent, client is reported as not configured", () => {
  const unconfiguredConfig = {
    supabaseUrl: null,
    supabaseAnonKey: null,
  };

  assert.equal(isSupabaseConfigured(unconfiguredConfig), false);
  assert.equal(createSupabaseClient(unconfiguredConfig), null);
  assert.equal(getSupabaseClient(unconfiguredConfig), null);

  // If ambient environment has no Supabase credentials, the default singleton is also null
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    assert.equal(supabase, null);
  }
});

test("TEST 2: When valid configuration is supplied, module initializes Supabase client without throwing", () => {
  const validConfig = {
    supabaseUrl: "https://test-project.supabase.co",
    supabaseAnonKey: "test-anon-key-abc-123",
  };

  assert.equal(isSupabaseConfigured(validConfig), true);

  const client = createSupabaseClient(validConfig);
  assert.ok(client !== null, "Client should be initialized");
  assert.ok(typeof client === "object", "Client should be an object");
  assert.ok(typeof client.from === "function", "Client should expose .from query method");
});
