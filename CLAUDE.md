# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a Turborepo monorepo with the following structure:

- `apps/api` - NestJS backend application (runs on port 3000)
- `apps/web` - Vite + React frontend application (runs on port 5173)
- `packages/@caseai-connect/api-contracts` - Shared API contracts and DTOs
- `packages/@repo/jest-config` - Shared Jest configurations
- `packages/@repo/typescript-config` - Shared TypeScript configurations
- `packages/@caseai-connect/ui` - Shared React component library

## Development Commands

All commands should be run from the root directory using Turbo (via npm scripts):

### Development
- `npx turbo dev` - Start all applications in development mode
- `npx turbo dev --filter=api` - Start only the API application
- `npx turbo dev --filter=web` - Start only the web application

### Building
- `npx turbo build` - Build all applications and packages
- `npx turbo build --filter=api` - Build only the API application
- `npx turbo build --filter=web` - Build only the web application

### Testing
- `npx turbo test` - Run all tests
- `npx turbo test --filter=api` - Run API tests only
- `npx turbo test --filter=web` - Run web tests only

### Code Quality
- `npx turbo lint` - Lint all packages and applications

### TypeScript Compilation Check
- `cd apps/api && npx tsc --noEmit` - Check API TypeScript without emitting files
- `cd apps/web && npx tsc --noEmit` - Check web TypeScript without emitting files

## Architecture Notes

### API Application
- Built with NestJS framework
- Entry point: `apps/api/src/main.ts`
- Main module: `apps/api/src/app.module.ts`
- Modular structure with feature-based modules under `apps/api/src/domains/`
- Uses dependency injection and decorators pattern
- See `apps/api/CLAUDE.md` for detailed API rules

### Web Application
- Vite + React (SPA) with React Compiler enabled via `babel-plugin-react-compiler`
- Redux for state management with feature-based slices/thunks/selectors
- Integrates with shared UI component library from `@caseai-connect/ui`
- Entry point: `apps/web/src/main.tsx`
- See `apps/web/CLAUDE.md` for detailed web rules

### Shared Packages
- `api-contracts`: DTOs and route definitions shared between API and web
  - All DTOs consolidated per domain: `packages/api-contracts/src/{domain}/{domain}.dto.ts`
  - All routes defined with `defineRoute` in `*.routes.ts` files
  - Everything exported from `packages/api-contracts/src/index.ts`
- All packages use TypeScript with strict configuration
- Jest configuration centralized in `@repo/jest-config`

## Package Management

- Uses npm workspaces for monorepo management
- Private packages with internal dependencies using `*` version specifier
- Engines requirement: Node.js >= 18

## Git

- Use semantic commit messages consistent with the repo history: `feat: ...`, `fix: ...`, `chore: ...`.
- Use scoped variants only when they match existing history and add clarity.

## Working in a Worktree (Claude Code)

Claude Code worktrees live under `.claude/worktrees/`. Gitignored config (`.env`, `.env.test`, root `dontsave/*.json`) is copied in automatically via `.worktreeinclude`. In a fresh worktree:

1. Run `npm ci` at the worktree root before anything else. Never `npm install` — it rewrites `package-lock.json` with cosmetic peer-flag churn that pollutes the diff.
2. Postgres and Redis (`infra/database` compose stack) are shared with the main checkout through localhost ports. Do not start a second stack, and remember that schema/migration changes hit the shared database.
3. Never start `npm run dev:workers-main` if workers already run in another checkout: two workers on the same Redis compete for the same BullMQ queues, and jobs may be processed by the other branch's code.
4. Dev servers are usually unnecessary in a worktree — typecheck, lint, and tests run without them. To run a second live stack anyway, override the ports in the copied env files (`PORT`, `FRONT_PORT`, `VITE_API_URL`, `FRONTEND_URL`).

## Code Style

### Descriptive Variable Names in Loops

**Rule**: NEVER use single-letter variables in loops (for, map, forEach, etc.). Always use descriptive, human-readable variable names based on the type of object being iterated.

```typescript
// ❌ Wrong
projects.map((p) => p.name)

// ✅ Correct
projects.map((project) => project.name)
```

### Neutral Sample Data in Mocks, Stories, and Fixtures

**Rule**: When generating sample/mock data (Storybook stories, test fixtures, seed scripts, factory overrides), use domain-neutral examples — generic agent names like "Helpful Assistant", tags like "Product/Pricing/Support", schemas with `{ title, summary }`. Do NOT infer a vertical from weak signals (the `MedGemma` model enum, a `gemma` feature flag, the repo name). Only use domain-specific samples if the user explicitly asks for them; if unsure, ask rather than guess.

## Completion Criteria

Before marking any work as completed, run and verify:

1. `npm run biome:check` — formatting and linting must pass
2. `npm run typecheck` — no TypeScript errors
3. `npm run test` — all tests must pass (API work)

Work is NOT complete until all applicable commands pass with exit code 0.
