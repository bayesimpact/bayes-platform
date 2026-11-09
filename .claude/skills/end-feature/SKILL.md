---
name: end-feature
description: Run the last steps before ending a feature. Shows a form where you can check/uncheck which final steps to run (update changelog, review the Desk conventions, CI checks, API tests, web tests, Desk checks, create a PR), then executes the selected steps in that order.
user_invocable: true
---

Wrap up a feature by running its final steps. Present a checklist form, then execute only the checked steps, **in the fixed order below**.

The work happens on the branch of the worktree that `/worktree-env` created at the start of the session. This skill creates no branch and never switches back to `main`.

## Step 0: show the checklist form

First list the files the feature changes: `git diff --name-only origin/main...HEAD` plus `git status --porcelain`. The pre-selections below depend on them.

Then call `AskUserQuestion` once, with two **multi-select** questions (`multiSelect: true`). A question takes 4 options at most, so the steps are split in two:

**Question 1, `header: "Steps"`**

- **Update changelog**: add an entry under `## [Unreleased]` in `CHANGELOG.md`
- **Review the Desk conventions**: a subagent reviews the diff of `apps/desk` (ADR 0031 stack) against `docs/frontend/conventions.md`. The `apps/web` conventions are not reviewed here
- **Create a PR**: push the branch and open a pull request with `gh`

**Question 2, `header: "Checks"`**

- **CI checks**: `make ci-checks` (Biome, typecheck, boundaries)
- **API tests**: `make tests-only-parallel`
- **Web tests**: `npm run test -w @caseai-connect/web`
- **Desk checks**: `npm run check -w @caseai-connect/desk`, then `npm run build -w @caseai-connect/desk`

Pre-select:

- **Update changelog** only when the change is visible to end users or security-relevant. Leave it unchecked for internal work: refactors, CI/tooling, docs, tests. Say in the question why it is unchecked; the user can still check it.
- **Review the Desk conventions** only when the diff touches `apps/desk`, `packages/desk-contracts` or `docs/frontend/`.
- **Create a PR** and **CI checks** always.
- The three test options with the path rules of the `changes` job in `.github/workflows/ci.yml`, so the form runs what CI will run. Read the rules there; do not copy them here. Name in the question the option you left unchecked and why.

Whatever the user leaves checked is the set to run. Run the checked steps **strictly in this order** and skip the unchecked ones.

## 1. Update changelog

Only if checked. Edit `CHANGELOG.md`, adding a line under `## [Unreleased]`:

- New capability → `### Added`; modified behavior → `### Changed`; bug fix → `### Fixed`; security hardening or vulnerability fix → `### Security`.
- **Write for end users, not developers**: describe the visible outcome, not entities, services or migrations.
- Prefix with `(beta)` if the feature is behind a flag or not yet exposed in the UI.
- **Write in STE (Simplified Technical English)**: short sentences (max 20 words), one fact per sentence, active voice.
- **One sentence per entry.** Even a large feature gets one headline sentence naming the capability or the new status (e.g. "Agents now have a draft and a published version of their settings."), not the mechanics. No sub-bullets. Never chain clauses with ";", "—", or "so".
- Name the capability, not the UI: no button placement, labels, colors, or click behavior. Keep dates and required user actions.
- Merge entries that belong to the same change into one. Delete an entry whose information is already carried by another.
- **Verify before writing**: check the actual commits and code for how a change works (runtime vs data migration, full vs partial scope). Scope claims exactly: write "New CSV extraction runs are personal." when existing data is unaffected.
- Do not add an entry for a bug that was never in a released version. Check that the bug's cause was in the last release tag before listing a fix.

## 2. Review the Desk conventions

Only if checked. Dispatch the `frontend-conventions-reviewer` subagent (Agent tool, `subagent_type: "frontend-conventions-reviewer"`) on the current branch's diff. It reports what breaks the rules no tool checks, and edits nothing.

- Fix each finding. The Desk checks of step 3 then run on the fixed code; if they are unchecked, run `npm run check -w @caseai-connect/desk` anyway.
- A finding you disagree with goes to the user with your reasoning; do not skip it silently.
- Commit the fixes with the feature's other changes.

## 3. Checks and tests

Run each checked option from the repository root, in the order of the form. When one fails, **stop** and report the failure with its output. Do not run the next ones and do not open the PR. Let the user fix and re-run.

- **CI checks**: `make ci-checks`. When Biome reports formatting, `npm run biome:check` fixes it; run `make ci-checks` again.
- **API tests**: `make tests-only-parallel`. It starts the test database if needed, runs the migrations on it, then the API suite in parallel. In a worktree with an environment, it uses that environment's test database (see "Working in a Worktree" in `CLAUDE.md`).
- **Web tests**: `npm run test -w @caseai-connect/web`.
- **Desk checks**: `npm run check -w @caseai-connect/desk`, then `npm run build -w @caseai-connect/desk`.

## 4. Create a PR

Only if checked. The rules of a PR live in other files. Read them at this step and follow them as they are written today. Do not copy them into this skill.

| Rule | Source of truth |
|------|-----------------|
| Commit and PR title format | `CLAUDE.md` ▸ *Git*, and the types table of the `commit` skill (`.claude/skills/commit/SKILL.md`) |
| What a public repository must never mention | `CLAUDE.md` ▸ *Git* |
| Public API contract, maintainer go, `public-contract-approved` label | `docs/public-api-contract.md` |
| Changelog entries only under `[Unreleased]` | `.github/scripts/changelog-check.mjs` (header comment) |
| Commit and PR attribution lines | the attribution reminder of the current session |

Steps:

1. **Check the branch.** Run `git branch --show-current`. On `main`, stop: the work belongs on a worktree branch, so suggest `/worktree-env`.
2. **Commit** the uncommitted changes, with a message that follows the sources above.
3. **Check conformity** before pushing. Go through each row of the table against the commits, the planned title and body, and the diff:
   - grep the commit messages, the title and the body for the names the *Git* section forbids;
   - when the diff touches a file the public contract covers, run the local check given in `docs/public-api-contract.md`. A failure there means the PR needs a maintainer's label: tell the user before opening it;
   - when `CHANGELOG.md` changed, run the local dry run given at the top of `.github/scripts/changelog-check.mjs`.

   Report one line per rule: met, fixed, or blocked with the reason. Fix what you can; ask the user about the rest before going on.
4. **Push** the branch: `git push -u origin <branch>`.
5. **Open the PR** with a heredoc body that ends with the session's attribution line:
   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   ## Summary
   <what changed and why>

   <attribution line>
   EOF
   )"
   ```
6. Report the PR URL as a clickable link, with the conformity report of step 3.

## Notes

- Respect the order: changelog → Desk review → checks and tests → PR. Never reorder.
- If the user unchecks everything, there is nothing to do: say so.
- If a step's precondition isn't met, point out the conflict and ask before proceeding rather than guessing.
