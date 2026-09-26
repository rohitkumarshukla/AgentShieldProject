const VALID_NODE_ENVS = new Set(["development", "test", "production"]);

/**
 * Validates and normalizes raw environment variables into a typed configuration object.
 *
 * Designed as a pure function to allow unit testing without mutating global process.env.
 *
 * @param {Record<string, string | undefined>} [env=process.env]
 * @returns {{
 *   port: number,
 *   nodeEnv: "development" | "test" | "production",
 *   supabaseUrl: string | null,
 *   supabaseAnonKey: string | null
 * }}
 */
export function parseConfig(env = process.env) {
  // 1. Resolve and validate PORT
  let port = 3000;
  if (env.PORT !== undefined && env.PORT !== "") {
    const rawPort = String(env.PORT).trim();
    // Verify pure integer string
    if (!/^\d+$/.test(rawPort)) {
      throw new Error(`Invalid PORT configuration: "${env.PORT}". Must be an integer between 1 and 65535.`);
    }

    const parsedPort = Number(rawPort);
    if (parsedPort < 1 || parsedPort > 65535) {
      throw new Error(`Out-of-range PORT configuration: ${parsedPort}. Must be between 1 and 65535.`);
    }
    port = parsedPort;
  }

  // 2. Resolve and validate NODE_ENV
  let nodeEnv = "development";
  if (env.NODE_ENV !== undefined && env.NODE_ENV !== "") {
    const rawEnv = String(env.NODE_ENV).trim();
    if (!VALID_NODE_ENVS.has(rawEnv)) {
      throw new Error(
        `Invalid NODE_ENV configuration: "${env.NODE_ENV}". Must be one of: ${Array.from(VALID_NODE_ENVS).join(", ")}.`,
      );
    }
    nodeEnv = rawEnv;
  }

  // 3. Resolve and validate SUPABASE_URL
  let supabaseUrl = null;
  if (env.SUPABASE_URL !== undefined && env.SUPABASE_URL !== "") {
    const rawUrl = String(env.SUPABASE_URL).trim();
    try {
      const parsedUrl = new URL(rawUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }
      supabaseUrl = parsedUrl.href;
    } catch {
      throw new Error(`Invalid SUPABASE_URL configuration: "${env.SUPABASE_URL}". Must be a valid HTTP or HTTPS URL.`);
    }
  }

  // 4. Resolve and validate SUPABASE_ANON_KEY
  let supabaseAnonKey = null;
  if (env.SUPABASE_ANON_KEY !== undefined && env.SUPABASE_ANON_KEY !== "") {
    const rawKey = String(env.SUPABASE_ANON_KEY).trim();
    if (rawKey.length === 0) {
      throw new Error("Invalid SUPABASE_ANON_KEY configuration. Key must be a non-empty string when provided.");
    }
    supabaseAnonKey = rawKey;
  }

  return Object.freeze({
    port,
    nodeEnv,
    supabaseUrl,
    supabaseAnonKey,
  });
}

/**
 * Singleton configuration object initialized from process.env.
 */
export const config = parseConfig(process.env);
