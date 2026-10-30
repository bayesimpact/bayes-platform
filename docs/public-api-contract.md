# Public API contract

The public chat API is a contract with external integrators. This file is the single source of truth for the rule. `AGENTS.md`, `CLAUDE.md` and `apps/api/CLAUDE.md` point here.

## What the contract is

Every route, request and response DTO, header, status code, error message and server-sent event served under `PUBLIC_PATH_PREFIX` (`/public/...`), on the versioned paths of each served major. The shared types those DTOs use are part of it.

Served majors:

- **v2** (`/public/v2/...`), since 2026-10-30. The help pages document it, and `apps/web-embed` speaks it.
- **v1** (`/public/v1/...`), deprecated since v2 and frozen on 1.2. It stops on 2027-05-31, the date published on the help site. Its folders are deleted in a separate PR after that date.

The unprefixed paths that predated versioning (`/public/agents/...`) were removed with v2, once no client called them. They answer `404`.

Source files:

- `packages/api-contracts/src/public-chat/v<n>/`: one folder per major, with its routes (`PublicChatV<n>Routes`), its DTOs (exported as the `PublicChatV<n>` namespace), its version constant `PUBLIC_API_V<n>_VERSION` and its type pins
- `packages/api-contracts/src/public-chat/public-chat.prefix.ts`: what every major shares, the path prefix and helper types
- `apps/api/src/domains/public-chat/v<n>/`: one folder per served major, each with its controller (one method per route), its DTO mappers and its e2e tests, `public-contract.spec.ts` among them
- `apps/api/src/domains/public-chat/guards/`
- `apps/api/src/domains/public-chat/e2e-tests/app-routes.spec.ts`: every major's routes in AppModule's order
- the `/public/*` branch of `apps/api/src/config/cors.ts`
- the help pages `apps/help/src/content/docs/{en,fr}/public-chat-api*.mdx`

Published documentation: the help site of each platform instance, page `/en/public-chat-api` (French under `/fr/`).

## The rule

1. Do not change the contract without a written go from a maintainer: `@jdoucy`, `@alexisjamet`, `@did` or `@OlivierDoucy`. Ask on the issue or the PR first. Wait for the go.
2. The maintainer records the go with the `public-contract-approved` label on the PR. The approving maintainer must not be the PR author. A maintainer's own change needs another maintainer's label.
3. An additive change (new route, new field, new optional property, new event type) is a minor version: `1.0` becomes `1.1`. URLs do not change.
4. A rename, a removal, a type change, an optional element made required, a status code, error message or framing change is a breaking change. While `apps/web-embed` is the only client of the API, a breaking change ships as a minor version on the same paths: the changelog pages list it under "Changed" with its migration steps, and the widget handles it in the same PR. The CTO decided this on 2026-10-29 (410 for purged sessions, API 1.2). A breaking change once external integrators exist needs a new major version under a new path prefix (`/public/v2/...`). The previous major stays served for the deprecation period published on the help site.
5. Every contract change lands in one PR with: the bump of the changed major's constant (`PUBLIC_API_V<n>_VERSION` in `v<n>/public-chat-v<n>.version.ts`), the updated type pins in that major's DTO file, its updated `public-contract.spec.ts`, the reference page and the changelog page in EN and FR (frontmatter `apiVersion` equal to the newest major's constant, a `## <version> (<date>)` entry on the changelog page), and a `CHANGELOG.md` entry. A change to the shared `public-chat.prefix.ts` is a change to every major.
6. Keep explanations on the help pages. A comment-only edit inside `packages/api-contracts/src/public-chat/` also requires a version bump.

## Shipping a new major version

v2 shipped this way on 2026-10-30. Adding a new major (v3) must not change one byte of what the older majors serve. The layout is built for that, but only if the new major gets its own copy of everything the contract is made of. Checklist for that PR:

1. **Versioned contracts package.** Create `packages/api-contracts/src/public-chat/v3/` with its own routes, DTO and version files. Export `PublicChatV3Routes`, the `PublicChatV3` DTO namespace and its constants. No unversioned export: no consumer can float between majors without noticing.
2. **Copy the DTOs, never extend them.** A new DTO must not `extends` or reuse an older major's DTO, and the older DTOs never change again. Shared fields are duplicated on purpose: a type reused by two majors is a type that cannot be frozen.
3. **Pin the shared types per major.** Every type a versioned DTO imports from outside its folder (stream events, enums, shared shapes) gets its own `PublicContractPins` entry inside that major's folder. A refactor elsewhere in the monorepo must fail the older majors' typecheck, not silently change their output.
4. **One server folder per served contract.** Create `apps/api/src/domains/public-chat/v3/` with its controller, its mappers and its e2e tests, mirroring the previous major. Each major's mappers import only from its own contracts folder. Nothing is shared but the injected service, which returns entities, never DTOs. Register the controller in `PublicChatModule` and add its routes to `e2e-tests/app-routes.spec.ts`.
5. **The shared layer is not versioned.** `PublicChatService`, the guards, the CORS branch and the SSE framing serve every major at once. Stream failures are one `{ type: "error" }` event on a 200 response, never a JSON error nor a bare `event: error` frame; that framing is part of every major. A change there for a new major is a change to the older ones too: keep their `e2e-tests/` green and untouched, and treat any needed edit there as a contract change of those majors under the rule above.
6. **Move the first-party client to the new major.** `apps/web-embed` speaks one major only, the newest. Update it in the same PR. Do not keep an older code path in the widget.
7. **Version the version.** Give the new major its own constant, add it to `MAJORS` in `.github/scripts/public-contract-check.mjs` and to `.github/CODEOWNERS`, and set the `apiVersion` of the help pages to its version.
8. **Publish the deprecation date of the previous major** on the help site before merging, at least 6 months after the new major ships. Deleting a major's folders is a separate PR that lands after that date.

## The type pins

Each major's DTO file (`v<n>/public-chat-v<n>.dto.ts`) restates the shared shapes it depends on and pins them with its own `PublicContractPins`. When `npm run typecheck` fails there, a shared type changed the public contract. Do not edit the pin to make it pass. Apply the rule above first.

## The CI check

The `public-contract` workflow (`.github/workflows/public-contract.yml`, script `.github/scripts/public-contract-check.mjs`) runs on every PR to `main`, including label events. It fails when:

- a contract file or a public help page changes and the label is missing, or was set by someone who is not a maintainer, or by the PR author;
- a major's contracts folder (or the shared `public-chat.prefix.ts`) changes and that major's `PUBLIC_API_V<n>_VERSION` did not, or the changelog pages have no entry for the new version;
- any public help page carries an `apiVersion` different from the newest major's constant.

Run it locally from the repository root:

```bash
BASE_SHA=$(git merge-base origin/main HEAD) PR_LABELS="" node .github/scripts/public-contract-check.mjs
```
