# AGENTS.md (apps/api)

The API rules for this app are in `apps/api/CLAUDE.md`. Read that file first; it is the reference for NestJS, DTOs, controllers, tests and migrations.

## Public API contract

The routes under `PUBLIC_PATH_PREFIX` (`/public/...`) are a frozen contract with external integrators. Read `docs/public-api-contract.md` before touching `packages/api-contracts/src/public-chat/`, the public chat controller, guards, CORS or the public help pages. No change without a maintainer's written go and the `public-contract-approved` label.
