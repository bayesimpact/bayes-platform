# Changelog rules

This file holds every rule for `CHANGELOG.md`. It is the single source: skills, `CLAUDE.md` and ADRs
point here and copy nothing. To change a rule, change it here only.

[ADR 0003](adr/0003-product-versioning-strategy.md) keeps the decision behind the changelog: the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format and CalVer versions. This file keeps
the rules that follow from it.

## When to write an entry

- Write an entry when end users can see the change, or when it is relevant to security.
- Write no entry for internal work: refactors, CI and tooling, docs, tests.
- Write no fix entry for a bug that was never in a released version. Check that the bug's cause
  was in the last release tag before you list a fix.
- A change to the public API contract always needs an entry
  (see [the public API contract](public-api-contract.md)).
- Write the entry in the PR that ships the change.

## Where an entry goes

- Under `## [Unreleased]`, never under a released version. CI fails a PR that adds or changes a
  line under a released version (see "Checks" below).
- In one of these categories. Add its `###` heading under `[Unreleased]` when it is missing.

  | Category | Use it for |
  |----------|------------|
  | `### Added` | a new capability |
  | `### Changed` | a change to an existing behavior |
  | `### Deprecated` | a capability that will go away |
  | `### Removed` | a capability taken away |
  | `### Fixed` | a bug fix |
  | `### Security` | security hardening or a vulnerability fix |

- Merge the entries of one change into one. Delete an entry when another one already carries its
  information.

## Feature flags and `(beta)`

A feature behind a feature flag, or not yet exposed in the UI, takes the `(beta)` prefix. Its entry
goes **last in its category**.

To know whether a feature is behind a flag:

- The flag keys are declared in `packages/api-contracts/src/feature-flags/feature-flags.dto.ts`.
- The code checks them with `hasFeature`, `hasFeatureOrThrow`, `RestrictedFeature` and
  `isFeatureEnabled`.
- Look in the diff for a new key and for those calls. Also check whether the changed screens or
  endpoints already sit behind a flag.

## How to write an entry

- **Start with the capability's name and a colon** when the entry is about a named capability.
- **One sentence per entry**, 20 words at most. Even a large feature gets one headline sentence
  that names the capability or its new status. No sub-bullets. Never chain clauses with ";", "—"
  or "so".
- **Write in Simplified Technical English**: one fact per sentence, active voice, simple words.
- **Write for end users.** Name the capability and the visible outcome. Do not name entities,
  services, migrations, jobs or columns.
- **Name the capability, not the UI.** Do not describe button placement, labels, colors or click
  behavior. Keep dates and the actions users must take.
- **Avoid "now".** The release the entry sits under already says when the change came. Use "now"
  only when the entry misleads without it, for example a behavior that changed for existing data.
- **Verify before you write.** Check the commits and the code for how the change works: a runtime
  change or a data migration, the full scope or a part of it. Scope the claim exactly: write "New
  CSV extraction runs are personal." when existing data is unaffected.

Examples:

| Avoid | Write |
|-------|-------|
| Add mcp_server and agent_mcp_server tables with encrypted config | Agent MCP servers: agents connect to external MCP servers for more tools. |
| Fix race condition in streaming service timeout check | Agent replies no longer time out too early. |
| Agents now have a draft and a published version of their settings. | Agent drafts: each agent has a draft and a published version of its settings. |
| Apps catalog: project owners and admins can browse the apps they can connect. (behind a flag) | (beta) Apps catalog: project owners and admins can browse the apps they can connect. |

## Checks

- CI runs `.github/scripts/changelog-check.mjs` on every PR. Its header comment gives the command
  for a local dry run.
- A release promotes `[Unreleased]` to a versioned section. See
  [Making a release](architecture.md#making-a-release).
