# Public API contract

The public chat API is a contract with external integrators. This file is the single source of truth for the rule. `AGENTS.md`, `CLAUDE.md` and `apps/api/CLAUDE.md` point here.

## What the contract is

Every route, request and response DTO, header, status code, error message and server-sent event served under `PUBLIC_PATH_PREFIX` (`/public/...`), on the versioned paths (`/public/v1/...`) and on the unprefixed legacy alias (`/public/agents/...`). The shared types those DTOs use are part of it.

Source files:

- `packages/api-contracts/src/public-chat/` (routes, DTOs, `PUBLIC_API_VERSION`, type pins)
- `apps/api/src/domains/public-chat/public-chat.controller.ts` and `public-chat.mappers.ts`
- `apps/api/src/domains/public-chat/guards/`
- `apps/api/src/domains/public-chat/e2e-tests/public-contract.spec.ts`
- the `/public/*` branch of `apps/api/src/config/cors.ts`
- the help pages `apps/help/src/content/docs/{en,fr}/public-chat-api*.mdx`

Published documentation: the help site of each platform instance, page `/en/public-chat-api` (French under `/fr/`).

## The rule

1. Do not change the contract without a written go from a maintainer: `@jdoucy`, `@alexisjamet`, `@did` or `@OlivierDoucy`. Ask on the issue or the PR first. Wait for the go.
2. The maintainer records the go with the `public-contract-approved` label on the PR. The approving maintainer must not be the PR author. A maintainer's own change needs another maintainer's label.
3. An additive change (new route, new field, new optional property, new event type) is a minor version: `1.0` becomes `1.1`. URLs do not change.
4. A rename, a removal, a type change, an optional element made required, a status code, error message or framing change is a breaking change. It needs a new major version under a new path prefix (`/public/v2/...`). The previous major, and for v1 its legacy alias, stays served for the deprecation period published on the help site.
5. Every contract change lands in one PR with: the `PUBLIC_API_VERSION` bump in `packages/api-contracts/src/public-chat/public-chat.version.ts`, the updated type pins in `public-chat.dto.ts`, the updated `public-contract.spec.ts`, the reference page and the changelog page in EN and FR (frontmatter `apiVersion` equal to the constant, a `## <version> (<date>)` entry on the changelog page), and a `CHANGELOG.md` entry.
6. Keep explanations on the help pages. A comment-only edit inside `packages/api-contracts/src/public-chat/` also requires a version bump.

## The type pins

`public-chat.dto.ts` restates the shared shapes it depends on and pins them with `PublicContractPins`. When `npm run typecheck` fails there, a shared type changed the public contract. Do not edit the pin to make it pass. Apply the rule above first.

## The CI check

The `public-contract` workflow (`.github/workflows/public-contract.yml`, script `.github/scripts/public-contract-check.mjs`) runs on every PR to `main`, including label events. It fails when:

- a contract file or a public help page changes and the label is missing, or was set by someone who is not a maintainer, or by the PR author;
- `packages/api-contracts/src/public-chat/` changes and `PUBLIC_API_VERSION` did not, or the changelog pages have no entry for the new version;
- any public help page carries an `apiVersion` different from `PUBLIC_API_VERSION`.

Run it locally from the repository root:

```bash
BASE_SHA=$(git merge-base origin/main HEAD) PR_LABELS="" node .github/scripts/public-contract-check.mjs
```
