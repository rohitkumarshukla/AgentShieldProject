// Risk is an evaluation result only; score calculation belongs to a future
// risk service rather than the domain type.
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskFactorType =
  | "DESTRUCTIVE_ACTION"
  | "BULK_SCOPE"
  | "EXTERNAL_DESTINATION"
  | "SENSITIVE_DATA"
  | "PRODUCTION_ENVIRONMENT"
  | "FINANCIAL_IMPACT";

export interface RiskFactor {
  factor: RiskFactorType;
  points: number;
  reason: string;
}

export interface RiskAssessment {
  // Intended range: 0 through 100. Validation and calculation come later.
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}