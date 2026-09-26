import { getSupabaseClient, verifySupabaseConfiguration } from "../src/lib/supabase.js";
import { config } from "../src/config/env.js";

/**
 * Checks if a string looks like an unconfigured placeholder.
 * @param {string | null | undefined} str
 * @returns {boolean}
 */
function isPlaceholder(str) {
  if (!str) return true;
  const lower = str.toLowerCase();
  return (
    lower.includes("your-project-id") ||
    lower.includes("your-supabase") ||
    lower.includes("example.com") ||
    lower.includes("sample-anon-key")
  );
}

/**
 * Runs a comprehensive connectivity and health check for Supabase database.
 */
async function runCheck() {
  console.log("=================================================");
  console.log("      AgentShield Supabase Connection Check      ");
  console.log("=================================================");
  console.log("Current Configuration in backend/.env:");
  console.log(`- SUPABASE_URL:      ${config.supabaseUrl || "(not set)"}`);
  console.log(`- SUPABASE_ANON_KEY: ${config.supabaseAnonKey ? `(set, length: ${config.supabaseAnonKey.length})` : "(not set)"}`);
  console.log(`- Config Status:     ${verifySupabaseConfiguration().status}`);
  console.log("-------------------------------------------------");

  // Check 1: Missing credentials
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.log("❌ SUPABASE IS NOT CONFIGURED.");
    console.log("👉 Add your SUPABASE_URL and SUPABASE_ANON_KEY to backend/.env");
    return;
  }

  // Check 2: Placeholders detected
  const isUrlPlaceholder = isPlaceholder(config.supabaseUrl);
  const isKeyPlaceholder = isPlaceholder(config.supabaseAnonKey);

  if (isUrlPlaceholder || isKeyPlaceholder) {
    console.log("⚠️  PLACEHOLDER VALUES DETECTED IN backend/.env:");
    if (isUrlPlaceholder) {
      console.log(`  • SUPABASE_URL is still placeholder: "${config.supabaseUrl}"`);
    }
    if (isKeyPlaceholder) {
      console.log(`  • SUPABASE_ANON_KEY is still placeholder: "${config.supabaseAnonKey}"`);
    }
    console.log("\n👉 ACTION REQUIRED TO CONNECT TO YOUR DATABASE:");
    console.log("  1. Go to https://supabase.com/dashboard");
    console.log("  2. Select your project -> Project Settings -> API");
    console.log("  3. Copy your 'Project URL' and 'anon/public' key into backend/.env");
    console.log("-------------------------------------------------");
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    console.log("❌ Failed to initialize Supabase client instance.");
    return;
  }

  console.log("Attempting live connection to Supabase...");

  const tables = ["agents", "actions", "decisions", "audit_events"];

  try {
    for (const table of tables) {
      try {
        const { count, error, status, statusText } = await client
          .from(table)
          .select("*", { count: "exact", head: true });

        if (error) {
          if (
            error.code === "PGRST204" ||
            error.code === "PGRST116" ||
            error.message?.includes("does not exist") ||
            error.message?.includes("relation")
          ) {
            console.log(`  ⚠️  Table '${table}': Connected, but table does not exist yet (run SQL schema migrations).`);
          } else if (status === 401 || status === 403 || error.message?.includes("JWT") || error.message?.includes("apikey")) {
            console.log(`  ❌ Table '${table}': Authentication failed (HTTP ${status}). Check SUPABASE_ANON_KEY.`);
          } else {
            console.log(`  ❌ Table '${table}': Database error (code: ${error.code}) - ${error.message}`);
          }
        } else {
          console.log(`  ✅ Table '${table}': Accessible (Total rows: ${count ?? 0})`);
        }
      } catch (tableErr) {
        console.log(`  ❌ Table '${table}': Query failed - ${tableErr.message}`);
      }
    }

    console.log("\n-------------------------------------------------");
    console.log("✅ Supabase connection check completed.");
  } catch (err) {
    console.log("\n❌ NETWORK / CONNECTION FAILED:");
    console.log(`Message: ${err.message}`);
    if (err.code === "ENOTFOUND" || err.message?.includes("fetch failed")) {
      console.log("\n💡 Possible causes:");
      console.log("  1. The SUPABASE_URL domain does not exist or has a typo.");
      console.log("  2. Your internet connection is offline.");
    }
  }
}

// Execute with top-level error boundary
runCheck().catch((fatalErr) => {
  console.error("Fatal error during connection test:", fatalErr);
});
