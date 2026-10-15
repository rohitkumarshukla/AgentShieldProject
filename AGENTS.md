# AgentShield — AI coding agent guide

## Before you touch backend code

1. **Read** [`docs/BACKEND_CONTEXT.md`](docs/BACKEND_CONTEXT.md) — route map, security pipeline, gaps, and file dependencies.
2. **Read** this file for repo layout and non-negotiables.

## Project layout

| Path | Role |
|------|------|
| `backend/` | Express API, governance engines, Supabase repositories, `node:test` tests |
| `FrontEnd/` | React + TypeScript + Vite UI (currently uses `src/data/mockData.ts`, not live API) |
| `docs/BACKEND_CONTEXT.md` | Backend single source of truth |

## Commands

- Backend dev: `npm --prefix backend run dev`
- Backend tests: `npm --prefix backend test`
- Frontend dev: `npm --prefix FrontEnd run dev`
- DB check: `npm --prefix backend run test:db`

Run tests for the area you change. Follow existing `*.test.js` patterns (Node built-in test runner).

## Architecture rules (from actual code)

- **No controllers layer** — extend `backend/src/routes/*.js` and `services/`, not a new controller tier unless the repo is refactored deliberately.
- **Governed execution path:** `GovernedToolExecutor` → `action.service` → `security/interceptor.js` → risk → `policy.service` → optional `toolRegistry.executeOperation`. Do not bypass this for agent tool calls.
- **Do not** call `toolRegistry.executeOperation` from new code except inside the interceptor allow branch or a deliberately audited post-approval step that re-runs the pipeline (today `approval.service` bypasses — treat as known gap, do not extend bypasses).
- **Do not** let the frontend decide authorization or final policy outcomes; UI may display results only.
- **Do not** use an LLM for allow/deny decisions — risk and policy stay deterministic in `risk/riskEngine.js` and `policy/`.
- **Keep security logic server-side** — mount and use `middleware/agentAuth.js` and `middleware/userAuth.js` when adding protected routes; do not rely on `agentId` in the request body alone.
- **Supabase:** server uses `lib/supabase.js`; never expose `SUPABASE_SERVICE_ROLE_KEY` to FrontEnd or commit `.env`.
- **Reuse** existing services (`createActionService`, `createSecurityInterceptor`, repositories) before duplicating logic.
- **Prefer** wiring dependencies the way `toolRoutes.js` does (full repositories into `GovernedToolExecutor` / `createActionService`).
- **Incremental diffs** — one concern per change; avoid unrelated file edits.
- **After security changes**, run `npm --prefix backend test`.

## Preserve unless asked

- FrontEnd page structure and mock-driven demos until explicitly integrating API clients.
- Existing API response shape `{ success, data?, error? }`.
- ES module `import`/`export` style in backend.

## Known gaps (do not “paper over” in docs)

- Auth middleware exists but is **not mounted** on routes.
- `POST /api/v1/actions/execute` under-wires `createActionService` (missing `agentRepository`).
- Two policy paths: `DecisionEngine` + `PolicyEngine` vs interceptor + `policy.service.js`.
- Mock tool ids (`customer_crm`) ≠ DB `tools.id` UUIDs.
- No realtime backend.

## Where to implement next

See **§24 Security gaps** and **§23 Missing** in `docs/BACKEND_CONTEXT.md`, and the user-facing report sections Q/R from the backend audit task.
