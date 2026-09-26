# AgentShield Repository Guidance

## Project Structure

- `FrontEnd/` contains the React, TypeScript, and Vite application.
- `FrontEnd/src/pages/` contains page-level views; shared UI components live in `FrontEnd/components/`.
- `backend/` contains the Express API, domain logic, and Node.js tests.
- Keep frontend and backend changes within their respective packages unless a change genuinely crosses the boundary.

## Development Commands

- Frontend development server: `npm --prefix FrontEnd run dev`
- Frontend production build: `npm --prefix FrontEnd run build`
- Backend tests: `npm --prefix backend test`
- Backend development server: `npm --prefix backend run dev`

Run the focused test or build for the area changed. The backend uses Node's built-in test runner; follow the existing `*.test.js` patterns.

## Implementation Guidance

- Follow the existing JavaScript ES module and TypeScript/React conventions in the neighboring files.
- Keep risk scoring deterministic and authorization independent of any language model.
- Treat the product brief as the target experience, not proof that every described integration is implemented.
- Do not claim production database, authentication, live WebSocket, MCP gateway, or universal rollback support unless those capabilities are added and verified.
- Do not commit secrets, environment files, generated build output, or dependency directories.
