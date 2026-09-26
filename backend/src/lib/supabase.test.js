import assert from "node:assert/strict";
import test from "node:test";

import {
  createSupabaseClient,
  getSupabaseClient,
  isSupabaseConfigured,
  supabase,
  verifySupabaseConfiguration,
} from "./supabase.js";

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

test("TEST 3 (Task 18): verifySupabaseConfiguration reports status without exposing credentials", () => {
  const unconfigured = verifySupabaseConfiguration({ supabaseUrl: null, supabaseAnonKey: null });
  assert.equal(unconfigured.configured, false);
  assert.equal(unconfigured.clientInitialized, false);
  assert.equal(unconfigured.status, "UNCONFIGURED");

  const valid = verifySupabaseConfiguration({
    supabaseUrl: "https://test-verify.supabase.co",
    supabaseAnonKey: "test-anon-key-xyz",
  });
  assert.equal(valid.configured, true);
  assert.equal(valid.clientInitialized, true);
  assert.equal(valid.status, "INITIALIZED");
});
