# Public API contract

The public chat API is a contract with external integrators. This file is the single source of truth for the rule. `AGENTS.md`, `CLAUDE.md` and `apps/api/CLAUDE.md` point here.

## What the contract is

Every route, request and response DTO, header, status code, error message and server-sent event served under `PUBLIC_PATH_PREFIX` (`/public/...`), on the versioned paths (`/public/v1/...`) and on the unprefixed legacy alias (`/public/agents/...`). The shared types those DTOs use are part of it.

The legacy alias serves what it served before versioning and nothing more. It has no MCP App HTML route and its config carries no `bannerText`, both of which arrived with v1. Additions to v1 never reach the alias.

Source files:

- `packages/api-contracts/src/public-chat/` (routes, DTOs, `PUBLIC_API_VERSION`, type pins)
- `apps/api/src/domains/public-chat/{v1,legacy}/`: one folder per served contract, each with its controller (one method per route) and its DTO mappers
- `apps/api/src/domains/public-chat/guards/`
- `apps/api/src/domains/public-chat/v1/e2e-tests/public-contract.spec.ts` and `legacy/e2e-tests/legacy-alias.spec.ts`
- the `/public/*` branch of `apps/api/src/config/cors.ts`
- the help pages `apps/help/src/content/docs/{en,fr}/public-chat-api*.mdx`

Published documentation: the help site of each platform instance, page `/en/public-chat-api` (French under `/fr/`).

## The rule

1. Do not change the contract without a written go from a maintainer: `@jdoucy`, `@alexisjamet`, `@did` or `@OlivierDoucy`. Ask on the issue or the PR first. Wait for the go.
2. The maintainer records the go with the `public-contract-approved` label on the PR. The approving maintainer must not be the PR author. A maintainer's own change needs another maintainer's label.
3. An additive change (new route, new field, new optional property, new event type) is a minor version: `1.0` becomes `1.1`. URLs do not change.
4. A rename, a removal, a type change, an optional element made required, a status code, error message or framing change is a breaking change. It needs a new major version under a new path prefix (`/public/v2/...`). The previous major, and with v1 the legacy alias, stays served for the deprecation period published on the help site.
5. Every contract change lands in one PR with: the `PUBLIC_API_VERSION` bump in `packages/api-contracts/src/public-chat/public-chat.version.ts`, the updated type pins in `public-chat.dto.ts`, the updated `public-contract.spec.ts`, the reference page and the changelog page in EN and FR (frontmatter `apiVersion` equal to the constant, a `## <version> (<date>)` entry on the changelog page), and a `CHANGELOG.md` entry.
6. Keep explanations on the help pages. A comment-only edit inside `packages/api-contracts/src/public-chat/` also requires a version bump.

## Shipping a new major version

Adding v2 must not change one byte of what v1 serves. The layout is built for that, but only if the new major gets its own copy of everything the contract is made of. Checklist for the v2 PR:

1. **Versioned contracts package.** Create `packages/api-contracts/src/public-chat/v2/` with its own routes and DTO files, and move the v1 routes and DTOs into `v1/`. Export `PublicChatV1Routes` and `PublicChatV2Routes`. Remove the unversioned `PublicChatRoutes` export so no consumer can float between majors without noticing.
2. **Copy the DTOs, never extend them.** A v2 DTO must not `extends` or reuse a v1 DTO, and v1 DTOs never change again. Shared fields are duplicated on purpose: a type reused by two majors is a type that cannot be frozen.
3. **Pin the shared types per major.** Every type a versioned DTO imports from outside its folder (stream events, enums, shared shapes) gets its own `PublicContractPins` entry inside that major's folder. A refactor elsewhere in the monorepo must fail the v1 typecheck, not silently change v1 output.
4. **One server folder per major.** Create `apps/api/src/domains/public-chat/v2/` with its controller, its mappers and its e2e tests, mirroring `v1/`. The v2 mappers import only from the v2 contracts folder, the v1 mappers only from v1. Nothing is shared but the injected service.
5. **The shared layer is not versioned.** `PublicChatService`, the guards, the CORS branch and the SSE framing serve every major at once. A change there for v2 is a change to v1 too: keep `v1/e2e-tests/` green and untouched, and treat any needed edit there as a v1 contract change under the rule above.
6. **Move the first-party client to the new major.** `apps/web-embed` speaks one major only, the newest. Update it in the same PR. Do not keep a v1 code path in the widget.
7. **Version the version.** Give each served major its own constant so `1.x` and `2.x` can bump independently, and set the `apiVersion` of the help pages accordingly.
8. **Publish the deprecation date of the previous major** on the help site before merging. Deleting a major's folders is a separate PR that lands after that date.

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
