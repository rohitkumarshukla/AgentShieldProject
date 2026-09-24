# Risk module

`RiskEngine` is a pure, deterministic evaluator for an attempted action. It
adds only these explainable contributions: destructive action (+50), scope of
10–24 (+20), 25–99 (+35), or 100+ (+55), external destination (+20), sensitive
data (+20), production (+15), and financial impact of 1,000–9,999 (+25) or
10,000+ (+35); a smaller positive financial amount adds +10.

Scores are clamped to 100 and map to `LOW` (0–19), `MEDIUM` (20–49), `HIGH`
(50–79), and `CRITICAL` (80–100). The module intentionally has no HTTP,
database, policy, or external-service dependency.

Domain types remain in `src/types` so services, routes, and persistence can be
introduced without coupling core AgentShield concepts to a framework.