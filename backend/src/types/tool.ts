export type ToolCategory =
  | "CRM"
  | "EMAIL"
  | "DATABASE"
  | "INFRASTRUCTURE"
  | "FINANCE";

export interface Tool {
  id: string;
  name: string;
  description?: string;
  category: ToolCategory;
  enabled: boolean;
}
