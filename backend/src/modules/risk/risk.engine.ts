import type { Action } from "../../types/action.js";
import type {
  RiskAssessment,
  RiskFactor,
  RiskFactorType,
  RiskLevel,
} from "../../types/risk.js";

const DESTRUCTIVE_ACTION_PATTERN = /\b(delete|remove|destroy|purge|wipe)\b/i;
const SCOPE_KEY_PATTERN = /(records?|count|quantity|recipients?|items?|users?|customers?)/i;
const SCOPE_VALUE_PATTERN = /\b(\d[\d,]*)(?:\s+[a-z_-]+){0,2}\s+(records?|count|quantity|recipients?|items?|users?|customers?)\b/i;
const EXTERNAL_KEY_PATTERN = /(external|externalrecipient|destination|recipienttype)/i;
const SENSITIVE_PATTERN = /(sensitive|confidential|private|credentials?|financial|personal[_\s-]?data)/i;
const ENVIRONMENT_KEY_PATTERN = /^(environment|env)$/i;
const PRODUCTION_VALUE_PATTERN = /^(production|prod)$/i;
const FINANCIAL_KEY_PATTERN = /(amount|payment|price|cost|value|transfer|transaction)/i;
const CURRENCY_VALUE_PATTERN = /(?:[$€£]\s*|\b(?:usd|eur|gbp)\s*)(\d[\d,]*(?:\.\d+)?)/i;

// RiskEngine applies transparent, deterministic rules only. It has no I/O or
// mutable state so a given action always yields the same assessment.
export class RiskEngine {
  evaluate(action: Action): RiskAssessment {
    const factors: RiskFactor[] = [];

    if (DESTRUCTIVE_ACTION_PATTERN.test(action.type)) {
      factors.push(this.factor(
        "DESTRUCTIVE_ACTION",
        50,
        "Action can permanently delete or remove data",
      ));
    }

    const values = [action.parameters, action.metadata ?? {}, action.target];
    const scope = this.findLargestScope(values, action.type);
    if (scope >= 100) {
      factors.push(this.factor("BULK_SCOPE", 55, `Action affects a large scope of ${scope} items`));
    } else if (scope >= 25) {
      factors.push(this.factor("BULK_SCOPE", 35, `Action affects a bulk scope of ${scope} items`));
    } else if (scope >= 10) {
      factors.push(this.factor("BULK_SCOPE", 20, `Action affects a moderate scope of ${scope} items`));
    }

    if (this.hasExternalDestination(values)) {
      factors.push(this.factor(
        "EXTERNAL_DESTINATION",
        20,
        "Action sends information to an external destination",
      ));
    }

    if (this.hasSensitiveData(values)) {
      factors.push(this.factor("SENSITIVE_DATA", 20, "Action involves sensitive data"));
    }

    if (this.targetsProduction(values)) {
      factors.push(this.factor(
        "PRODUCTION_ENVIRONMENT",
        15,
        "Action targets a production environment",
      ));
    }

    const amount = this.findLargestFinancialAmount(values);
    if (amount >= 10_000) {
      factors.push(this.factor("FINANCIAL_IMPACT", 35, `Action has a financial impact of ${amount}`));
    } else if (amount >= 1_000) {
      factors.push(this.factor("FINANCIAL_IMPACT", 25, `Action has a financial impact of ${amount}`));
    } else if (amount > 0) {
      factors.push(this.factor("FINANCIAL_IMPACT", 10, `Action has a financial impact of ${amount}`));
    }

    const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));
    return { score, level: this.levelFor(score), factors };
  }

  private factor(factor: RiskFactorType, points: number, reason: string): RiskFactor {
    return { factor, points, reason };
  }

  private findLargestScope(values: unknown[], actionType: string): number {
    let largest = this.scopeFromString(actionType);
    this.visit(values, (key, value) => {
      if (typeof value === "number" && SCOPE_KEY_PATTERN.test(key)) {
        largest = Math.max(largest, value);
      }
      if (typeof value === "string") {
        largest = Math.max(largest, this.scopeFromString(value));
      }
    });
    return largest;
  }

  private hasExternalDestination(values: unknown[]): boolean {
    let found = false;
    this.visit(values, (key, value) => {
      if (EXTERNAL_KEY_PATTERN.test(key) && (value === true || /external|outside|third.party/i.test(String(value)))) {
        found = true;
      }
    });
    return found;
  }

  private hasSensitiveData(values: unknown[]): boolean {
    let found = false;
    this.visit(values, (key, value) => {
      if (SENSITIVE_PATTERN.test(key) || (typeof value === "string" && SENSITIVE_PATTERN.test(value))) {
        found = true;
      }
    });
    return found;
  }

  private targetsProduction(values: unknown[]): boolean {
    let found = false;
    this.visit(values, (key, value) => {
      if (ENVIRONMENT_KEY_PATTERN.test(key) && PRODUCTION_VALUE_PATTERN.test(String(value))) {
        found = true;
      }
    });
    return found;
  }

  private findLargestFinancialAmount(values: unknown[]): number {
    let largest = 0;
    this.visit(values, (key, value) => {
      if (typeof value === "number" && FINANCIAL_KEY_PATTERN.test(key)) {
        largest = Math.max(largest, value);
      }
      if (typeof value === "string") {
        const match = value.match(CURRENCY_VALUE_PATTERN);
        if (match) largest = Math.max(largest, Number(match[1].replaceAll(",", "")));
      }
    });
    return largest;
  }

  private scopeFromString(value: string): number {
    const match = value.match(SCOPE_VALUE_PATTERN);
    return match ? Number(match[1].replaceAll(",", "")) : 0;
  }

  private levelFor(score: number): RiskLevel {
    if (score >= 80) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 20) return "MEDIUM";
    return "LOW";
  }

  private visit(values: unknown[], callback: (key: string, value: unknown) => void): void {
    const visitValue = (value: unknown, key = ""): void => {
      if (Array.isArray(value)) {
        value.forEach((item) => visitValue(item, key));
      } else if (value && typeof value === "object") {
        Object.entries(value).forEach(([entryKey, entryValue]) => {
          callback(entryKey, entryValue);
          visitValue(entryValue, entryKey);
        });
      }
    };

    values.forEach((value) => visitValue(value));
  }
}
