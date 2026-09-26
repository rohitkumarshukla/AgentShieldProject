const TOOL_FIELDS = new Set(["name", "action_type", "target", "description", "risk_tier"]);
const RISK_TIERS = new Set(["low", "medium", "high", "critical"]);
const PUBLIC_TOOL_FIELDS = ["id", "name", "action_type", "target", "description", "risk_tier", "created_at"];

export class ToolServiceError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_TOOL") {
    super(message);
    this.name = "ToolServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function safeTool(tool) {
  if (!tool) return null;
  return Object.fromEntries(PUBLIC_TOOL_FIELDS.filter((field) => tool[field] !== undefined).map((field) => [field, tool[field]]));
}

export function createToolService(repository) {
  function validate(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ToolServiceError("Request body must be an object");
    const unknown = Object.keys(input).filter((field) => !TOOL_FIELDS.has(field));
    if (unknown.length) throw new ToolServiceError(`Unsupported tool field: ${unknown[0]}`);
    if (typeof input.name !== "string" || !input.name.trim()) throw new ToolServiceError("name is required and must be non-empty");
    if (typeof input.action_type !== "string" || !input.action_type.trim()) throw new ToolServiceError("action_type is required and must be non-empty");
    if (input.description !== undefined && input.description !== null && typeof input.description !== "string") {
      throw new ToolServiceError("description must be a string or null");
    }
    if (input.target !== undefined && input.target !== null && typeof input.target !== "string") {
      throw new ToolServiceError("target must be a string or null");
    }
    if (input.risk_tier !== undefined && !RISK_TIERS.has(input.risk_tier)) {
      throw new ToolServiceError("risk_tier must be low, medium, high, or critical");
    }
    return {
      ...input,
      name: input.name.trim(),
      action_type: input.action_type.trim(),
      ...(typeof input.target === "string" ? { target: input.target.trim() } : {}),
      ...(typeof input.description === "string" ? { description: input.description.trim() } : {}),
    };
  }

  return {
    async create(input) {
      const normalized = validate(input);
      try {
        const tool = await repository.createTool(normalized);
        if (!tool) throw new Error("Tool creation returned no record");
        return safeTool(tool);
      } catch (error) {
        if (error?.code === "23505") throw new ToolServiceError("A tool with that name already exists", 409, "TOOL_CONFLICT");
        throw error;
      }
    },
    async list() { return (await repository.listTools()).map(safeTool); },
    async get(id) {
      const tool = await repository.getToolById(id);
      if (!tool) throw new ToolServiceError("Tool not found", 404, "TOOL_NOT_FOUND");
      return safeTool(tool);
    },
  };
}
