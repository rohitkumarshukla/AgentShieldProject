// Risk is an evaluation result only; score calculation belongs to a future
// risk service rather than the domain type.
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskFactor {
  code: string;
  reason: string;
}

export interface RiskAssessment {
  // Intended range: 0 through 100. Validation and calculation come later.
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}
