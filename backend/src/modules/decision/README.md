# Decision Pipeline Module

## Responsibility

The **Decision Pipeline** is the deterministic orchestration layer in AgentShield. It coordinates the transition from an incoming agent action to a final, authoritative governance decision.

Crucially, the pipeline **contains no risk scoring rules or policy rules of its own**. Instead, it cleanly delegates those responsibilities to the specialized engines:
1. **Risk Engine** calculates transparent, multidimensional risk metrics.
2. **Policy Engine** evaluates declarative organizational policies against the action and risk assessment.

## Processing Sequence

```text
Action
  ↓
RiskEngine.evaluate(action)
  ↓
RiskAssessment (score, level, factors)
  ↓
PolicyEngine.evaluate(action, riskAssessment, [policies])
  ↓
PolicyEvaluationResult (outcome, matchedPolicies, selectedPolicy, reason)
  ↓
Final Decision Result (ALLOW | REQUIRE_APPROVAL | BLOCK)
```

1. **Receive Action**: The pipeline accepts an `Action` object describing the agent tool invocation or operation.
2. **Risk Assessment**: The action is forwarded to `RiskEngine.evaluate(action)`. This produces a deterministic `RiskAssessment` containing the numerical score (0-100), risk level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and identified risk factors.
3. **Policy Evaluation**: The action and its `RiskAssessment` are forwarded to `PolicyEngine.evaluate(action, riskAssessment, policies)`. The policy engine matches active policies, resolves conflicts (blocking rules take precedence, then numerical priority, then stable ID order), and determines the policy outcome.
4. **Construct Final Decision**: The pipeline aggregates the results into a `DecisionResult` exposing the evaluated action, full risk assessment, policy evaluation result, final governance outcome (`ALLOW`, `REQUIRE_APPROVAL`, or `BLOCK`), and explanation reason directly from the policy evaluation.

## Inputs and Outputs

* **Input**:
  * `action: Action`
  * (Optional) `policies?: readonly Policy[]` (defaults to the Policy Engine's configured policies or `DEFAULT_POLICIES`)
* **Output**:
  * `DecisionResult`:
    * `action: Action`
    * `riskAssessment: RiskAssessment`
    * `policyEvaluation: PolicyEvaluationResult`
    * `finalOutcome: DecisionOutcome` (`ALLOW` | `REQUIRE_APPROVAL` | `BLOCK`)
    * `reason: string`

## Relationship with Risk Engine and Policy Engine

* **Separation of Concerns**: The Decision Pipeline acts strictly as an orchestrator. Risk analysis is decoupled from policy enforcement, and policy matching is decoupled from execution.
* **Dependency Injection**: The pipeline accepts `RiskEngine` and `PolicyEngine` via constructor options. This enables seamless unit testing and dependency swapping without relying on global singletons.

## Determinism

The pipeline is strictly deterministic:
* It does not rely on wall-clock time, random number generators, network calls, environment variables, LLM evaluations, or external database queries to reach a decision.
* Identical actions presented with identical policies will produce identical decisions every time.
* Failures in either engine are allowed to propagate; the pipeline never silently catches unexpected exceptions to fall back to an unsafe `ALLOW`.
