# Policies module

`PolicyEngine` consumes an `Action` and the already-calculated `RiskAssessment`;
it never calculates risk itself. Starter policies are evaluated in descending
priority (then policy ID), while conflict selection always gives `BLOCK`
precedence over `REQUIRE_APPROVAL` and `ALLOW` before using priority.

When no policy matches, the engine returns `REQUIRE_APPROVAL`. This conservative
default prevents unrecognized actions from becoming implicit allows. The
financial review policy uses the risk engine's 1,000 financial-impact threshold.
