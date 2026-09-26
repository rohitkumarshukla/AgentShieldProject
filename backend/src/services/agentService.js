import { createHash, randomBytes } from "node:crypto";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const ALLOWED_STATUS = new Set(["active", "inactive"]);
const CREATE_FIELDS = new Set(["name", "description"]);
const UPDATE_FIELDS = new Set(["name", "description", "status"]);

export class AgentServiceError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_AGENT") {
    super(message);
    this.name = "AgentServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function safeAgent(agent) {
  if (!agent) return null;
  const { api_key_hash, api_key, apiKey, ...safe } = agent;
  return safe;
}

export function createAgentService(repository, { generateKey = () => randomBytes(32).toString("base64url"), hashKey = (key) => createHash("sha256").update(key).digest("hex"), now = () => new Date().toISOString() } = {}) {
  function validateObject(body, fields, { requireName = false } = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0) {
      throw new AgentServiceError("Request body must be a non-empty JSON object");
    }
    const unknown = Object.keys(body).filter((field) => !fields.has(field));
    if (unknown.length) throw new AgentServiceError(`Unsupported field: ${unknown[0]}`);
    if ((requireName && !Object.hasOwn(body, "name")) || (Object.hasOwn(body, "name") && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > MAX_NAME_LENGTH))) {
      throw new AgentServiceError(`name is required and must contain 1 to ${MAX_NAME_LENGTH} characters`);
    }
    if (Object.hasOwn(body, "description") && body.description !== null && (typeof body.description !== "string" || body.description.length > MAX_DESCRIPTION_LENGTH)) {
      throw new AgentServiceError(`description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters or null`);
    }
    if (Object.hasOwn(body, "status") && (typeof body.status !== "string" || !ALLOWED_STATUS.has(body.status))) {
      throw new AgentServiceError("status must be either active or inactive");
    }
    return { ...body, ...(typeof body.name === "string" ? { name: body.name.trim() } : {}) };
  }

  return {
    async create(body) {
      const input = validateObject(body, CREATE_FIELDS, { requireName: true });
      const apiKey = generateKey();
      const agent = await repository.createAgent({ ...input, status: "active", api_key_hash: hashKey(apiKey) });
      if (!agent) throw new Error("Agent creation returned no record");
      return { agent: safeAgent(agent), api_key: apiKey };
    },
    async list() { return (await repository.listAgents()).map(safeAgent); },
    async get(id) {
      const agent = await repository.getAgentById(id);
      if (!agent) throw new AgentServiceError("Agent not found", 404, "NOT_FOUND");
      return safeAgent(agent);
    },
    async update(id, body) {
      const updates = validateObject(body, UPDATE_FIELDS);
      const agent = await repository.updateAgent(id, { ...updates, updated_at: now() });
      if (!agent) throw new AgentServiceError("Agent not found", 404, "NOT_FOUND");
      return safeAgent(agent);
    },
    async rotateKey(id) {
      const existing = await repository.getAgentById(id);
      if (!existing) throw new AgentServiceError("Agent not found", 404, "NOT_FOUND");
      const apiKey = generateKey();
      const agent = await repository.updateApiKeyHash(id, hashKey(apiKey));
      if (!agent) throw new AgentServiceError("Agent not found", 404, "NOT_FOUND");
      return { agent: safeAgent(agent), api_key: apiKey };
    },
  };
}
