import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RiskServiceError,
  RISK_BANDS,
  getRiskBand,
  explainRiskAssessment,
  mapToolCallToAction,
  createRiskService,
} from "./risk.service.js";

describe("Risk Service", () => {
  describe("Risk Bands & Mapping", () => {
    it("maps scores to correct risk bands", () => {
      assert.equal(getRiskBand(10).level, "LOW");
      assert.equal(getRiskBand(29).level, "LOW");
      assert.equal(getRiskBand(30).level, "MEDIUM");
      assert.equal(getRiskBand(59).level, "MEDIUM");
      assert.equal(getRiskBand(60).level, "HIGH");
      assert.equal(getRiskBand(79).level, "HIGH");
      assert.equal(getRiskBand(80).level, "CRITICAL");
      assert.equal(getRiskBand(100).level, "CRITICAL");
    });

    it("clamps negative scores and scores above 100", () => {
      assert.equal(getRiskBand(-10).level, "LOW");
      assert.equal(getRiskBand(150).level, "CRITICAL");
    });

    it("provides descriptions and default decision expectations for each band", () => {
      assert.equal(RISK_BANDS.LOW.defaultDecision, "ALLOW");
      assert.equal(RISK_BANDS.MEDIUM.defaultDecision, "APPROVAL_REQUIRED");
      assert.equal(RISK_BANDS.HIGH.defaultDecision, "APPROVAL_REQUIRED");
      assert.equal(RISK_BANDS.CRITICAL.defaultDecision, "BLOCK");
    });
  });

  describe("explainRiskAssessment", () => {
    it("formats empty factor list into clean low-risk message", () => {
      const explanation = explainRiskAssessment({ score: 0, level: "LOW", factors: [] });
      assert.match(explanation, /No elevated risk factors/i);
    });

    it("formats factor list with point breakdowns", () => {
      const explanation = explainRiskAssessment({
        score: 70,
        level: "HIGH",
        factors: [
          { code: "DESTRUCTIVE_ACTION", description: "Delete action is inherently destructive", points: 50 },
          { code: "EXTERNAL_DESTINATION", description: "Action sends data externally", points: 20 },
        ],
      });
      assert.match(explanation, /70\/100 \(HIGH\)/);
      assert.match(explanation, /Delete action is inherently destructive \(\+50 pts\)/);
      assert.match(explanation, /Action sends data externally \(\+20 pts\)/);
    });
  });

  describe("mapToolCallToAction", () => {
    it("maps destructive CRM delete tool call correctly", () => {
      const action = mapToolCallToAction({
        agentId: "10000000-0000-0000-0000-000000000001",
        toolId: "customer_crm",
        operation: "bulkDeleteCustomers",
        parameters: { count: 147, filter: "inactive" },
        environment: "production",
      });

      assert.equal(action.actionType, "delete");
      assert.equal(action.scope.count, 147);
      assert.equal(action.environment, "production");
      assert.equal(action.sensitivity.level, "sensitive");
    });

    it("maps external email tool call correctly", () => {
      const action = mapToolCallToAction({
        agentId: "20000000-0000-0000-0000-000000000002",
        toolId: "email_sender",
        operation: "bulkSendEmails",
        parameters: { recipientCount: 38 },
        environment: "production",
      });

      assert.equal(action.destination.type, "external");
      assert.equal(action.scope.count, 38);
      assert.equal(action.actionType, "write");
    });

    it("maps low-risk knowledge base query correctly", () => {
      const action = mapToolCallToAction({
        agentId: "40000000-0000-0000-0000-000000000004",
        toolId: "knowledge_base",
        operation: "queryDocuments",
        parameters: { limit: 12 },
        environment: "development",
      });

      assert.equal(action.actionType, "read");
      assert.equal(action.scope.count, 12);
      assert.equal(action.destination.type, "internal");
    });

    it("maps financial impact parameters correctly", () => {
      const action = mapToolCallToAction({
        toolId: "financial_ledger",
        operation: "createTransaction",
        parameters: { amount: 15000 },
      });

      assert.equal(action.financialImpact, 15000);
      assert.equal(action.sensitivity.level, "sensitive");
    });
  });

  describe("createRiskService", () => {
    const riskService = createRiskService();

    it("evaluates a canonical action and returns score, level, band, and explanation", () => {
      const action = mapToolCallToAction({
        agentId: "10000000-0000-0000-0000-000000000001",
        toolId: "customer_crm",
        operation: "bulkDeleteCustomers",
        parameters: { count: 147 },
        environment: "production",
      });

      const result = riskService.evaluateAction(action);
      assert.equal(result.score, 100);
      assert.equal(result.level, "CRITICAL");
      assert.equal(result.band.level, "CRITICAL");
      assert.equal(result.band.defaultDecision, "BLOCK");
      assert.ok(result.factors.length > 0);
      assert.match(result.explanation, /100\/100 \(CRITICAL\)/);
      assert.ok(result.timestamp);
    });

    it("evaluates a raw tool call directly via evaluateToolCall", () => {
      const result = riskService.evaluateToolCall({
        agentId: "40000000-0000-0000-0000-000000000004",
        toolId: "knowledge_base",
        operation: "queryDocuments",
        parameters: { limit: 5 },
        environment: "development",
      });

      assert.equal(result.score, 0);
      assert.equal(result.level, "LOW");
      assert.equal(result.band.level, "LOW");
      assert.equal(result.band.defaultDecision, "ALLOW");
    });

    it("throws RiskServiceError on invalid action input", () => {
      assert.throws(
        () => riskService.evaluateAction(null),
        (err) => err instanceof RiskServiceError && err.statusCode === 400
      );
    });

    it("returns complete list of risk bands via getRiskBands", () => {
      const bands = riskService.getRiskBands();
      assert.ok(bands.LOW);
      assert.ok(bands.MEDIUM);
      assert.ok(bands.HIGH);
      assert.ok(bands.CRITICAL);
    });
  });
});
