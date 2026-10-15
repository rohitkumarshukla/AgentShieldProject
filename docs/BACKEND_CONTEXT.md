# AgentShield Backend — Single Source of Truth

Last updated from codebase inspection (read-only audit). All paths are relative to `AgentShieldProject/backend/` unless noted.

---

## 1. Backend overview

AgentShield backend is a **plain Node.js (ES modules) Express 4 API** that implements deterministic **risk scoring**, **policy decisions**, **human approval**, **audit logging**, and **mock tool execution** for AI agent actions. There is **no separate `controllers/` layer** — route modules wire HTTP directly to services, engines, and Supabase repositories.

Two overlapping governance paths exist:

| Path | Entry | Pipeline | Executes tools? |
|------|--------|----------|-----------------|
| **Decision evaluation** | `POST /api/v1/decisions` | Validate action → optional agent/DB tool permission → `DecisionEngine` (risk + policy) → persist → audit | No |
| **Governed execution** | `POST /api/v1/actions/execute`, `POST /api/v1/tools/execute` | `ActionService` → `SecurityInterceptor` (authz → risk → policy) → allow / approval / block → optional `ToolRegistry` | Yes (mock handlers) |

**Human dashboard auth** (`userAuth`) and **agent API key auth** (`agentAuth`) are **implemented as middleware** but **not mounted on any route** in `src/app.js`.

**Realtime (Socket.IO / WebSockets):** not present in backend.

**AI/LLM:** not used in backend source.

---

## 2. Tech stack (from code)

| Area | Technology | How it is used |
|------|------------|----------------|
| Runtime | Node.js (ESM `"type": "module"`) | `src/server.js` entry |
| Framework | Express 4 | `src/app.js`, route modules |
| Language | JavaScript | All backend source |
| Database | PostgreSQL via Supabase | SQL migrations in `src/db/`; repositories use `@supabase/supabase-js` `.from()` |
| DB client | `@supabase/supabase-js` | `src/lib/supabase.js` — prefers **service role key** when set, else anon key |
| Human auth | Supabase Auth JWT | `src/middleware/userAuth.js` — `client.auth.getUser(token)` — **not wired to routes** |
| Agent auth | SHA-256 hashed API keys (`ash_live_…`) | `src/middleware/agentAuth.js` — lookup `agents.api_key_hash` — **not wired to routes** |
| Authorization (agent) | In-memory rules on agent `metadata.permissions` | `src/services/authorization.service.js` — used inside `SecurityInterceptor` when agent record is loaded |
| Authorization (human RBAC) | Static `ROLE_PERMISSIONS` map | `authorization.service.js` — middleware helpers exist but **not used on routes** |
| DB tool permissions | `agent_tool_permissions` table | `permissionService.checkAgentToolPermission` — used on `POST /decisions` when `toolId`/`tool_id` sent |
| Validation | Domain validators | `src/domain/actionValidator.js`, `agentValidator.js`, `audit/auditEventValidator.js`; service-level validation in tool/permission services |
| Risk | Deterministic `RiskEngine` | Sum of factor points, clamp 0–100, map to LOW/MEDIUM/HIGH/CRITICAL |
| Policy | `PolicyEngine` + extended `policy.service.js` | Decisions: ALLOW, APPROVAL_REQUIRED, BLOCK |
| Testing | Node built-in `node:test` | `npm test` → `node --test`; `*.test.js` beside source |
| Config | `src/config/env.js` | `PORT`, `NODE_ENV`, `SUPABASE_*`; loads `backend/.env` via `process.loadEnvFile` when available |
| External APIs | None in production path | Mock tool handlers only |

---

## 3. Folder structure

```
backend/
├── package.json
├── package-lock.json
├── .env                    # gitignored; local secrets (do not commit)
├── scripts/
│   ├── seed.js
│   └── testConnection.js
└── src/
    ├── server.js           # HTTP listen
    ├── app.js              # Express app + route mounts
    ├── audit/              # Audit event factory + validator
    ├── config/             # env.js, supabase re-export
    ├── db/                 # SQL migrations + seed.schema.sql
    ├── decision/           # DecisionEngine (risk + policy coordinator)
    ├── domain/             # action, validators
    ├── lib/                # supabase client factory
    ├── middleware/         # auth, errors, pagination, asyncHandler
    ├── policy/             # PolicyEngine + policy.service.js
    ├── repositories/       # Supabase data access
    ├── risk/               # RiskEngine + risk.service.js
    ├── routes/             # Express routers (no controllers/)
    ├── security/           # SecurityInterceptor
    ├── services/           # action, approval, audit, agent, tool, permission, authorization
    ├── tools/              # toolRegistry, mockTools, governedToolExecutor
    └── utils/              # ApiError.js
```

**Not present:** `controllers/`, `models/` (ORM), Socket.IO, policy CRUD routes, LLM clients.

---

## 4. File dependency map

### HTTP stack

```
src/server.js
   ↓ imports config from src/config/env.js
   ↓ imports src/app.js
src/app.js
   ↓ express.json(), CORS inline middleware
   ↓ mounts src/routes/*.js under /api/v1
   ↓ inline GET /, GET /health
   ↓ 404 handler (inline)
   ↓ src/middleware/errorHandler.js
```

### Governed tool execution (primary MVP path)

```
POST /api/v1/tools/execute  OR  POST /api/v1/actions/execute
   ↓ src/routes/toolRoutes.js  OR  src/routes/actionRoutes.js
   ↓ src/tools/governedToolExecutor.js  OR  direct createActionService
   ↓ src/services/action.service.js  →  createAndExecuteAction()
   ↓ src/security/interceptor.js  →  interceptToolAction()
        ├─ src/services/authorization.service.js  (if agent loaded)
        ├─ src/risk/riskEngine.js
        └─ src/policy/policy.service.js  →  PolicyEngine fallback
   ↓ persistence (best-effort): actionRepository, decisionRepository, auditEventRepository
   ↓ on ALLOW: src/tools/toolRegistry.js  →  mock operation handlers
   ↓ on APPROVAL_REQUIRED: approvalRepository.createApproval (if repo wired)
```

### Decision-only path (no tool execution)

```
POST /api/v1/decisions
   ↓ src/routes/decisionRoutes.js
   ↓ src/domain/action.js + actionValidator.js
   ↓ optional agentRepository + permissionService (tool UUID)
   ↓ src/decision/decisionEngine.js
        ├─ src/risk/riskEngine.js
        └─ src/policy/policyEngine.js
   ↓ repositories: action, decision, audit
   ↓ src/audit/auditEvent.js
```

### Approval resume (bypasses interceptor on execute)

```
POST /api/v1/approvals/:id/approve
   ↓ src/routes/approvalRoutes.js
   ↓ src/services/approval.service.js  →  approveAction()
   ↓ src/tools/toolRegistry.js  →  executeOperation()  (direct, no re-risk/policy)
```

---

## 5. Route map

**Convention:** No route uses `userAuth` or `agentAuth`. All listed API routes are **public** unless Supabase is unconfigured (503 on DB-dependent handlers).

| Method | Endpoint | Route file | Handler layer | Service / engine | Auth (mounted) | Purpose |
|--------|----------|------------|---------------|------------------|----------------|---------|
| GET | `/` | `src/app.js` | inline | — | Public | API welcome |
| GET | `/health` | `src/app.js` | inline | — | Public | Liveness |
| POST | `/api/v1/decisions` | `routes/decisionRoutes.js` | route handler | `DecisionEngine`, repos | Public | Evaluate action; persist decision + audit |
| GET | `/api/v1/decisions/:id` | `routes/decisionHistoryRoutes.js` | route | `decisionRepository` | Public | Get decision by id |
| GET | `/api/v1/actions/:actionId/decision` | `routes/decisionHistoryRoutes.js` | route | `decisionRepository` | Public | Decision by action id |
| POST | `/api/v1/agents` | `routes/agentRoutes.js` | route | `agentRepository` | Public | Create agent + API key |
| GET | `/api/v1/agents` | `routes/agentRoutes.js` | route + pagination | `agentRepository` | Public | List agents |
| GET | `/api/v1/agents/:id` | `routes/agentRoutes.js` | route | `agentRepository` | Public | Get agent |
| PATCH/PUT | `/api/v1/agents/:id` | `routes/agentRoutes.js` | route | `agentRepository` | Public | Update agent |
| DELETE | `/api/v1/agents/:id` | `routes/agentRoutes.js` | route | `agentRepository` | Public | Delete agent |
| GET | `/api/v1/agents/:id/permissions` | `routes/agentRoutes.js` | route | `agentRepository` (metadata) | Public | Read permissions from metadata |
| PUT/PATCH | `/api/v1/agents/:id/permissions` | `routes/agentRoutes.js` | route | `agentRepository` | Public | Write permissions to metadata |
| POST | `/api/v1/agents/:id/rotate-key` | `routes/agentRoutes.js` | route | `agentRepository` | Public | Rotate API key |
| GET | `/api/v1/actions/:id` | `routes/actionRoutes.js` | route | `action.service` | Public | Get action |
| GET | `/api/v1/agents/:agentId/actions` | `routes/actionRoutes.js` | route + pagination | `action.service` | Public | List actions for agent |
| POST | `/api/v1/actions/execute` | `routes/actionRoutes.js` | route | `action.service` → interceptor | Public | Governed execute (**incomplete DI — see gaps**) |
| POST | `/api/v1/tools/execute` | `routes/toolRoutes.js` | route | `GovernedToolExecutor` | Public | Governed execute (full repos when Supabase configured) |
| POST | `/api/v1/tools/:id/test` | `routes/toolRoutes.js` | route | `GovernedToolExecutor` (dryRun) | Public | Dry-run; default nil agent UUID |
| POST | `/api/v1/tools` | `routes/toolRoutes.js` | route | `toolService` | Public | Create DB tool row |
| GET | `/api/v1/tools` | `routes/toolRoutes.js` | route | `toolService` | Public | List DB tools |
| GET | `/api/v1/tools/:id` | `routes/toolRoutes.js` | route | `toolService` | Public | Get DB tool (UUID) |
| POST | `/api/v1/permissions` | `routes/permissionRoutes.js` | route | `permissionService` | Public | Grant agent↔tool permission |
| GET | `/api/v1/permissions?agentId=` | `routes/permissionRoutes.js` | route | `permissionService` | Public | List permissions for agent |
| DELETE | `/api/v1/permissions/:id` | `routes/permissionRoutes.js` | route | `permissionService` | Public | Revoke permission |
| GET | `/api/v1/approvals` | `routes/approvalRoutes.js` | route + pagination | `approval.service` | Public | List approvals |
| GET | `/api/v1/approvals/:id` | `routes/approvalRoutes.js` | route | `approval.service` | Public | Get approval + action |
| POST | `/api/v1/approvals/:id/approve` | `routes/approvalRoutes.js` | route | `approval.service` | Public | Approve + **direct tool execute** |
| POST | `/api/v1/approvals/:id/reject` | `routes/approvalRoutes.js` | route | `approval.service` | Public | Reject |
| GET | `/api/v1/audit-events/stats` | `routes/auditRoutes.js` | route | `audit.service` | Public | Stats |
| GET | `/api/v1/audit-events/export` | `routes/auditRoutes.js` | route | `audit.service` | Public | CSV/JSON export |
| GET | `/api/v1/audit-events` | `routes/auditRoutes.js` | route + pagination | `audit.service` | Public | Filtered list |
| GET | `/api/v1/audit-events/:id` | `routes/auditRoutes.js` | route | `audit.service` | Public | Detail + integrity hash |
| GET | `/api/v1/actions/:actionId/audit-events` | `routes/auditRoutes.js` | route + pagination | `auditEventRepository` | Public | By action |
| GET | `/api/v1/agents/:agentId/audit-events` | `routes/auditRoutes.js` | route + pagination | `auditEventRepository` | Public | By agent |

**Route categories**

- **Health:** `GET /health`, `GET /`
- **Public API:** all `/api/v1/*` (no auth middleware)
- **Admin / agent / demo:** no dedicated route prefixes; demo behavior is mock tools + public endpoints
- **Protected:** none mounted today

**Incomplete / duplicate**

- `POST /decisions` vs `POST /tools/execute`: different policy stacks (`PolicyEngine` only vs `policy.service.js` extended rules).
- `POST /actions/execute` wires `createActionService({ actionRepository })` only — missing `agentRepository`, `approvalRepository`, etc.
- `src/services/agentService.js` exists but **agent routes use `agentRepository` directly**.
- `src/middleware/notFound.js` exists; **app uses inline 404** instead.

---

## 6. Middleware

| Middleware | File | Used on |
|------------|------|---------|
| `express.json()` | `app.js` | Global |
| CORS (`Access-Control-Allow-Origin: *`) | `app.js` | Global |
| `validatePaginationMiddleware` | `middleware/pagination.js` | agents list, actions list, audit list, approvals list |
| `asyncHandler` | `middleware/asyncHandler.js` | decisionRoutes POST, toolRoutes, permissionRoutes |
| `errorHandler` | `middleware/errorHandler.js` | Global (after routes) |
| `agentAuth` | `middleware/agentAuth.js` | **Not mounted** |
| `userAuth` | `middleware/userAuth.js` | **Not mounted** |
| `requireUserRole` / `requireUserPermission` | `authorization.service.js` | **Not mounted** |
| `logRequestError` | `middleware/requestErrorLogger.js` | Called from routes/errorHandler |

---

## 7. Authentication

### Human (Supabase Auth)

- **Used?** Client supports `getUser(jwt)` in `userAuth.js`.
- **Token:** `Authorization: Bearer <supabase_access_token>`.
- **Verification:** `createUserAuthMiddleware` → `client.auth.getUser(token)`.
- **Request attachment:** `req.user`, `req.userId`, `req.userEmail`, `req.userRole`.
- **Routes requiring it:** **none**.

### Agent (API key)

- **Mechanism:** API key in `x-agent-api-key`, `x-api-key`, or `Authorization: Bearer|ApiKey <key>`.
- **Storage:** SHA-256 hex in `agents.api_key_hash`; plaintext shown once on create/rotate.
- **Verification:** `agentAuth.js` → `agentRepository.getAgentByApiKeyHash`.
- **Request attachment:** `req.agent`, `req.agentId`, etc.
- **Routes requiring it:** **NOT IMPLEMENTED (middleware not mounted)**.
- **Runtime identification today:** caller supplies `agentId` in JSON body; optional DB lookup only inside interceptor **if** `agentRepository` is injected into `ActionService`.

---

## 8. Agent system

### Model / table

`agents` — see Database schema. Permissions primarily in `metadata.permissions` (JSON); separate `agent_tool_permissions` for UUID tool rows.

### APIs

CRUD + permissions + rotate-key in `agentRoutes.js` (public).

### Action request path (governed)

```
HTTP body { agentId, toolId, operation, parameters, environment, dryRun }
   ↓ agentId from body (NOT from API key)
   ↓ SecurityInterceptor: load agent IF agentRepository configured
   ↓ authorizeAgentToolAction(agent, { toolId, operation, ... })
   ↓ RiskEngine.evaluate(mapped action)
   ↓ policy.service.evaluatePolicyAsync
   ↓ audit + optional DB persist
   ↓ ActionService: execute or approval or block
```

**Missing unless wired:** agent API key auth on execute routes; binding `req.agent.id` to body `agentId`; DB permission table enforcement on execute path (only on `/decisions` with tool UUID).

### Frontend expectations

`FrontEnd/src/data/mockData.ts` — **static mock data**; no `fetch` to backend in `FrontEnd/src` (UI not wired to API yet).

---

## 9. Security pipeline

| Security layer | Exists? | File(s) | Main function | Status |
|----------------|---------|---------|---------------|--------|
| Agent authentication | Partial | `middleware/agentAuth.js` | `createAgentAuthMiddleware` | Implemented but **not applied to routes** |
| Interceptor | Yes | `security/interceptor.js` | `interceptToolAction`, `interceptAction` | Used by `action.service.js` |
| Authorization | Partial | `services/authorization.service.js` | `authorizeAgentToolAction` | Runs only when agent record resolved; metadata permissions, not DB `agent_tool_permissions` on execute path |
| Risk engine | Yes | `risk/riskEngine.js` | `evaluate` | Deterministic factor sum |
| Policy engine | Yes | `policy/policyEngine.js`, `policy/policy.service.js` | `evaluate`, `evaluatePolicyAsync` | Interceptor uses **policy.service**; DecisionEngine uses **policyEngine** only |
| Approval | Partial | `services/approval.service.js`, `repositories/approvalRepository.js` | `createPendingApproval`, `approveAction` | Created from action.service; approve **skips** interceptor |
| Tool executor | Yes | `tools/toolRegistry.js`, `tools/mockTools.js` | `executeOperation` | Mock handlers only |
| Audit | Yes | `audit/auditEvent.js`, repositories, `audit.service.js` | `createAuditEvent`, `recordAuditEvent` | Multiple status vocabularies |

---

## 10. Risk engine

**File:** `src/risk/riskEngine.js` — `RiskEngine.evaluate(action)`.

**Model (actual):** additive factors (not separate “base risk” field):

| Factor code | Condition | Points |
|-------------|-----------|--------|
| DESTRUCTIVE_ACTION | `actionType === delete` | 50 |
| BULK_SCOPE_* | count ≥10 / ≥25 / ≥100 | 20 / 35 / 55 |
| EXTERNAL_DESTINATION | `destination.type === external` | 20 |
| SENSITIVE_DATA | sensitivity sensitive/restricted | 20 |
| PRODUCTION_ENVIRONMENT | `environment === production` | 15 |
| FINANCIAL_IMPACT_* | >0 / ≥1000 / ≥10000 INR | 10 / 25 / 35 |

**Score:** sum clamped 0–100. **Levels:** LOW &lt;20, MEDIUM &lt;50, HIGH &lt;80, CRITICAL ≥80.

**Also:** `risk.service.js` — bands metadata, `mapToolCallToAction`, explanations (not all wired to HTTP).

**Storage:** `decisions.risk_*`, `audit_events.risk_*`.

**API:** indirect via `/decisions`, `/actions/execute`, `/tools/execute`.

---

## 11. Policy engine

**In-code (runtime):** `PolicyEngine.evaluate` — 5 baseline rules (bulk delete block, critical block, external email approval, high approval, low/medium allow).

**Extended:** `policy.service.js` — additional rules (agent threshold, financial guardrail, production infra, custom policy matchers).

**Database `policies` table:** defined in `0001_core_schema.sql` — **no repository or CRUD routes**; seed data in `seed.schema.sql` not loaded by app automatically.

**Outcomes:** `ALLOW`, `APPROVAL_REQUIRED`, `BLOCK` — `requiresHumanApproval` flag on approval outcomes.

**User-facing name mapping:** product may say REQUIRE_APPROVAL; code uses `APPROVAL_REQUIRED`.

---

## 12. Tool system

- **In-memory registry:** `tools/toolRegistry.js` + `tools/mockTools.js` (string tool ids: `customer_crm`, `email_sender`, …).
- **DB registry:** `tools` table + `toolService` / `toolRepository` (UUID ids) — **separate** from mock registry ids used by execute endpoints.
- **Governed path:** `GovernedToolExecutor.invokeGovernedTool` → `action.service.createAndExecuteAction`.
- **Direct execution:** `ToolRegistry.executeOperation` — used after ALLOW in action.service and **directly** in `approval.service.approveAction`.

**Bypass question:** Can agent call tool without AgentShield checks?

- **Yes, after human approve:** `approval.service.js` calls `toolRegistry.executeOperation` with **no** interceptor re-run.
- **Yes, if authorization skipped:** interceptor skips authz when `agentRepository` null (`/actions/execute` wiring).
- **Yes, `/decisions`:** never executes tools.
- **No** on successful path through `GovernedToolExecutor` with repos configured — goes through interceptor first.

---

## 13. Approval flow

1. `APPROVAL_REQUIRED` from interceptor/action.service.
2. `approvalRepository.createApproval` (status lowercase `pending` in code vs SQL `PENDING` — verify in deployment).
3. Human: `POST /approvals/:id/approve` or `reject`.
4. Approve: updates approval, **`toolRegistry.executeOperation`**, audit with status `APPROVED_AND_EXECUTED` (may not match DB CHECK enum).

**Re-check before execute on approve:** **MISSING** (no agent status, policy, or risk re-evaluation).

---

## 14. Audit system

**Factory:** `audit/auditEvent.js` — statuses: `DECISION_MADE`, `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, `EXECUTED`, `BLOCKED`, `FAILED`.

**Service:** `audit.service.js` — list, export, stats, integrity SHA-256 helper.

**Events actually written (various paths):** decision route creates full audit; interceptor sets `DECISION_MADE` / `AWAITING_APPROVAL` / `BLOCKED`; action.service may add `EXECUTED`/`FAILED`; approval flow uses `APPROVED_AND_EXECUTED`, `REJECTED_BY_HUMAN`, `AWAITING_APPROVAL` — **not all match SQL CHECK constraint** on `audit_events.status`.

**Not observed as named audit types:** PROPOSED, INTERCEPTED, RISK EVALUATED, POLICY EVALUATED, AGENT PAUSED, etc.

**Realtime audit push:** none.

---

## 15. Database schema

### Tables (from migrations)

- `agents`, `actions`, `decisions`, `policies`, `approvals`, `audit_events`
- `tools`, `agent_tool_permissions` (0003)

### Relationship diagram

```
agents
   │
   ├──── actions ──── decisions (1:1 via uq_decisions_action_id)
   │        │
   │        ├──── approvals
   │        └──── audit_events
   │
   ├──── agent_tool_permissions ──── tools
   │
   └──── (metadata.permissions JSON — not FK)

policies (catalog; not FK-linked to decisions in app code)
```

### Client

`createSupabaseClient` in `lib/supabase.js`. Repositories in `repositories/*.js`.

---

## 16. Supabase integration

| Concern | Implementation |
|---------|----------------|
| URL | `SUPABASE_URL` in env |
| Anon key | `SUPABASE_ANON_KEY` — used for client if no service role |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` — **preferred** for server client when set |
| Auth verification | `userAuth.js` uses same client’s `auth.getUser` |
| Queries | All via PostgREST `.from().insert/select/...` |
| RLS | `0004_rls_policies.sql` — permissive `USING (true)` policies on core tables |
| Frontend | No Supabase client in FrontEnd/src inspected |

**Security note:** Service role must **never** ship to browser. Backend-only env is correct pattern; ensure `.env` stays gitignored.

---

## 17. Realtime

**NOT IMPLEMENTED** — no Socket.IO, ws, or SSE in backend.

---

## 18. Environment variables

| Variable | Used by | Purpose | Required? | Secret? |
|----------|---------|---------|-----------|---------|
| `PORT` | `config/env.js`, `server.js` | HTTP port (default 3000) | No | No |
| `NODE_ENV` | `config/env.js` | development/test/production | No | No |
| `SUPABASE_URL` | `lib/supabase.js` | Supabase project URL | For DB | No |
| `SUPABASE_ANON_KEY` | `lib/supabase.js`, `isSupabaseConfigured` | API key (anon/publishable) | For DB* | Yes (public tier) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.js` | Elevated server access | Optional | **Yes — highly sensitive** |
| `CORS_ORIGIN` | — | Present in `.env` only | No | No — **unused in code** |

\*Without URL + anon key, `supabase` is null and many routes return 503.

No `.env.example` in repo; use `scripts/testConnection.js` as setup guide.

---

## 19. Error handling

1. Route-level try/catch → JSON `{ success, error: { code, message } }`.
2. `asyncHandler` forwards rejections to `errorHandler`.
3. `errorHandler`: malformed JSON → 400; generic 500 without stack in response.
4. `logRequestError`: logs safe metadata to console (no stack in JSON log by default).
5. Inline 404 in `app.js`.

**Leaks:** route handlers generally avoid stack traces in JSON; repository errors may surface DB messages in some 500 paths. Do not expose `.env` via API.

---

## 20. Tests

- **Framework:** Node `node:test` + assert.
- **Coverage:** engines, interceptor, services, repositories (mock Supabase), route integration tests with ephemeral HTTP server.
- **Missing:** E2E with real Supabase; route tests for `/actions/execute` and `/tools/execute` governance; auth middleware integration; approval re-check security tests.

Run: `npm --prefix backend test`.

---

## 21. Current real functionality

- Express API with health check and CORS.
- Deterministic risk + policy evaluation (two policy code paths).
- Security interceptor orchestration when `ActionService` fully configured.
- Mock tool registry execution.
- Supabase repositories for agents, actions, decisions, audit, approvals, tools, permissions (when configured).
- Agent API key generation and hash storage on create/rotate.
- Audit listing, export, stats (service layer).
- Approval list/get/approve/reject.
- Extensive unit/integration tests for core domains.

---

## 22. Current mocks / placeholders

- All tool side effects: `mockTools.js` handlers (random ids, simulated success).
- `approval.service` simulated execution message when tool metadata missing.
- `action.service` fallback success object if registry missing execute method.
- `approvalRepository` in-memory fallback if approvals table missing.
- Frontend: `FrontEnd/src/data/mockData.ts` entirely local.
- `CORS_ORIGIN` env unused.

---

## 23. Current missing functionality

- Mount `agentAuth` / `userAuth` on appropriate routes.
- Wire `POST /actions/execute` with full `createActionService` dependencies.
- Unify policy evaluation (`DecisionEngine` vs `policy.service`).
- Policy CRUD API + load rules from `policies` table.
- Align mock tool ids with DB `tools` UUIDs or map between them.
- Enforce `agent_tool_permissions` on execute path.
- Re-run security pipeline on approval before tool execute.
- Realtime notifications.
- LLM/MCP gateway (not in codebase).
- Frontend ↔ backend API client layer.
- `.env.example` without secrets.

---

## 24. Security gaps

| Severity | File | Function / area | Problem | Why it matters |
|----------|------|-----------------|---------|----------------|
| Critical | `src/app.js` | route mounts | No auth on any API route | Anyone can create agents, approve actions, execute tools |
| Critical | `src/routes/actionRoutes.js` | `createActionService({ actionRepository })` | No `agentRepository` | Interceptor skips authorization stage |
| High | `src/routes/*` | execute endpoints | Trust `agentId` from body | Spoof any agent UUID |
| High | `src/services/approval.service.js` | `approveAction` | Direct `toolRegistry.executeOperation` | Bypasses risk/policy/interceptor |
| High | `src/db/0004_rls_policies.sql` | RLS policies | `USING (true)` for ALL | Anon key exposes full table access if used from client |
| Medium | `src/routes/decisionRoutes.js` | POST `/decisions` | Weaker policy engine vs execute path | Inconsistent governance |
| Medium | `src/routes/toolRoutes.js` | POST `/tools/:id/test` | Default nil UUID agent | Test endpoint runs pipeline without real agent |
| Medium | Approval status casing | repository vs SQL | `pending` vs `PENDING` | Inserts may fail against strict DB |
| Medium | Audit status strings | approval/action services | Custom statuses vs CHECK | Persistence failures / silent drops |
| Low | `src/app.js` | CORS `*` | Any origin | CSRF-style abuse from malicious sites calling open API |

---

## 25. End-to-end request flow (governed execute — intended)

**Entry:** `POST /api/v1/tools/execute` with Supabase configured.

| Step | File | Function | Input | Output |
|------|------|----------|-------|--------|
| HTTP | `routes/toolRoutes.js` | POST handler | JSON body | — |
| Tool lookup | `tools/toolRegistry.js` | `getOperation` | toolId, operation | toolDef or 400 |
| Service | `tools/governedToolExecutor.js` | `invokeGovernedTool` | request | — |
| Pipeline | `services/action.service.js` | `createAndExecuteAction` | agentId, toolId, … | result object |
| Intercept | `security/interceptor.js` | `interceptToolAction` | request | decision, action, risk, policy |
| Agent load | `repositories/agentRepository.js` | `getAgentById` | agentId | agent or skip authz |
| Authz | `authorization.service.js` | `authorizeAgentToolAction` | agent, tool op | authorized boolean |
| Risk | `risk/riskEngine.js` | `evaluate` | action | score, level, factors |
| Policy | `policy/policy.service.js` | `evaluatePolicyAsync` | action, risk | ALLOW / APPROVAL_REQUIRED / BLOCK |
| Audit | `audit/auditEvent.js` | `createAuditEvent` | action, risk, policy | audit object |
| Persist | `interceptor.js` | `_persistPipelineArtifacts` | artifacts | DB rows (best effort) |
| Branch | `action.service.js` | block / approval / execute | intercept result | HTTP JSON |
| Execute | `toolRegistry.js` | `executeOperation` | params | mock result |

**Missing steps when misconfigured:** agent authentication (middleware), agent repository on `/actions/execute`, permission table on execute path.

---

## 26. Important dependencies between files

- `action.service.js` **must** receive `agentRepository`, `approvalRepository`, `auditEventRepository`, `decisionRepository` for full pipeline + approvals (see `toolRoutes.js` for reference wiring).
- `GovernedToolExecutor` is the thin wrapper preferred for `/tools/execute`.
- `DecisionEngine` is **only** used by `decisionRoutes.js` and tests — not by interceptor.
- `permissionService` integrates with decisions route only when `toolId` UUID provided.
- `agentRoutes.js` duplicates key logic also present in `agentService.js` (unused).

---

## 27. Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `scripts/seed.js` | `npm run seed` | Seed Supabase data |
| `scripts/testConnection.js` | `npm run test:db` | Verify Supabase config |

---

*When changing backend behavior, update this document in the same PR as substantive code changes.*
