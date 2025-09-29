# Repository Guidelines

## Project Structure & Module Organization
- `src/main/`: Electron main-process code, preload bridge, and service layers (IPC, feed parsing, database adapters).
- `src/renderer/`: React UI written in TypeScript; components, Zustand stores, hooks, and utilities live here.
- `src/__tests__/`: Jest suites and mocks; mirror the renderer structure when possible.
- `docs/`: Product specs, milestone plans, and stage checklists; review before starting feature work.
- `build/` and `dist/`: Generated artifacts—never edit manually.

## Build, Test, and Development Commands
- `npm run dev`: Launches Electron (main) and Vite (renderer) in watch mode; best for day-to-day hacking.
- `npm run build`: Produces production-ready bundles for both processes.
- `npm run type-check`: Runs `tsc --noEmit` across main and renderer; gating check for PRs.
- `npm run lint`: Executes ESLint on `.ts/.tsx`; run `npm run lint:fix` to autofix style issues.
- `npm run test`: Executes Jest suites; add `--watch` during iterative test writing.

## Coding Style & Naming Conventions
- TypeScript with strict mode; use 2-space indentation and trailing commas where allowed.
- React components in PascalCase; hooks/functions in camelCase; constants in UPPER_SNAKE.
- Prefer functional components with clear `Props` interfaces; colocate component-specific styles.
- Tailwind is the default styling layer; avoid inline styles unless dynamic values are required.

## Testing Guidelines
- Jest is configured for unit and integration tests; place files beside code as `<name>.test.ts[x]`.
- Mock network I/O with `nock` or custom fixtures under `src/__tests__/mocks`.
- Aim for ≥80% coverage on new modules; add regression tests when fixing bugs.

## Commit & Pull Request Guidelines
- Write imperative, scoped commit messages (e.g., `fix: handle CORS errors in feed tester`).
- Squash fixup commits before opening a PR; keep the diff focused on a single concern.
- PRs should include: summary, testing evidence (`npm run test`, `npm run type-check`), and links to relevant doc tasks or issues.
- Attach UI screenshots or GIFs for renderer-facing changes.

## Security & Configuration Tips
- Store API keys and secrets outside the repo; prefer `.env.local` and document required variables.
- Run Electron in production mode before shipping to validate preload security and CSP settings.
