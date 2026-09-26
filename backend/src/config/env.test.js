import assert from "node:assert/strict";
import test from "node:test";

import { config, parseConfig } from "./env.js";

test("TEST 1: No PORT/NODE_ENV values -> defaults (port = 3000, nodeEnv = 'development')", () => {
  const result = parseConfig({});
  assert.equal(result.port, 3000);
  assert.equal(result.nodeEnv, "development");
});

test("TEST 2: Valid PORT and NODE_ENV values are parsed correctly", () => {
  const result = parseConfig({
    PORT: "8080",
    NODE_ENV: "production",
  });
  assert.equal(result.port, 8080);
  assert.equal(result.nodeEnv, "production");

  const testEnvResult = parseConfig({
    PORT: "4000",
    NODE_ENV: "test",
  });
  assert.equal(testEnvResult.port, 4000);
  assert.equal(testEnvResult.nodeEnv, "test");
});

test("TEST 3: Invalid PORT such as 'abc' fails clearly", () => {
  assert.throws(
    () => parseConfig({ PORT: "abc" }),
    {
      name: "Error",
      message: /Invalid PORT configuration/,
    },
  );

  assert.throws(
    () => parseConfig({ PORT: "3000a" }),
    {
      name: "Error",
      message: /Invalid PORT configuration/,
    },
  );
});

test("TEST 4: Out-of-range PORT such as '0' fails clearly", () => {
  assert.throws(
    () => parseConfig({ PORT: "0" }),
    {
      name: "Error",
      message: /Out-of-range PORT configuration/,
    },
  );
});

test("TEST 5: Out-of-range PORT such as '65536' fails clearly", () => {
  assert.throws(
    () => parseConfig({ PORT: "65536" }),
    {
      name: "Error",
      message: /Out-of-range PORT configuration/,
    },
  );
});

test("TEST 6: Invalid NODE_ENV fails clearly", () => {
  assert.throws(
    () => parseConfig({ NODE_ENV: "staging_invalid" }),
    {
      name: "Error",
      message: /Invalid NODE_ENV configuration/,
    },
  );
});

test("TEST 7: Exported config singleton is initialized and immutable", () => {
  assert.ok(typeof config.port === "number");
  assert.ok(typeof config.nodeEnv === "string");
  assert.ok(Object.isFrozen(config));
});

test("TEST 8 (Task 12): Supabase variables absent -> configuration remains valid", () => {
  const result = parseConfig({});
  assert.equal(result.supabaseUrl, null);
  assert.equal(result.supabaseAnonKey, null);
});

test("TEST 9 (Task 12): Valid SUPABASE_URL + SUPABASE_ANON_KEY -> parsed correctly", () => {
  const result = parseConfig({
    SUPABASE_URL: "https://xyzcompany.supabase.co",
    SUPABASE_ANON_KEY: "sample-anon-key-12345",
  });
  assert.equal(result.supabaseUrl, "https://xyzcompany.supabase.co/");
  assert.equal(result.supabaseAnonKey, "sample-anon-key-12345");
});

test("TEST 10 (Task 12): Invalid SUPABASE_URL -> clear configuration error", () => {
  const secretLikeUrl = "private-url-token";
  assert.throws(() => parseConfig({ SUPABASE_URL: secretLikeUrl }), (error) => {
    assert.match(error.message, /Invalid SUPABASE_URL configuration/);
    assert.equal(error.message.includes(secretLikeUrl), false);
    return true;
  });

  assert.throws(
    () => parseConfig({ SUPABASE_URL: "not-a-valid-url" }),
    {
      name: "Error",
      message: /Invalid SUPABASE_URL configuration/,
    },
  );

  assert.throws(
    () => parseConfig({ SUPABASE_URL: "ftp://example.com" }),
    {
      name: "Error",
      message: /Invalid SUPABASE_URL configuration/,
    },
  );
});

test("TEST 11 (Task 12): Empty/whitespace SUPABASE_ANON_KEY -> clear configuration error if explicitly supplied", () => {
  assert.throws(
    () => parseConfig({ SUPABASE_ANON_KEY: "   " }),
    {
      name: "Error",
      message: /Invalid SUPABASE_ANON_KEY configuration/,
    },
  );
});
