---
name: end-feature
description: Run the last steps before ending a feature. Shows a form where you can check/uncheck which final steps to run — update changelog, create a branch, run tests-parallel, create a PR — then executes the selected steps in that order.
user_invocable: true
---

Wrap up a feature by running its final steps. Present a checklist form, then execute only the checked steps, **in the fixed order below**.

## Step 0 — Show the checklist form

Before doing anything, call `AskUserQuestion` with a single **multi-select** question so the user can check/uncheck the steps. All four steps are pre-selected by default (list them as the options; the user unchecks any they want to skip):

- **Update changelog** — add an entry under `## [Unreleased]` in `CHANGELOG.md`
- **Create a branch** — move current work onto a feature branch
- **Run tests-parallel** — `make tests-parallel`
- **Create a PR** — open a pull request with `gh`

Use `header: "Steps"`, `multiSelect: true`. Whatever the user leaves checked is the set to run.

Then run the checked steps **strictly in this order** (skip unchecked ones):

## 1. Update changelog

Only if checked. Edit `CHANGELOG.md`, adding a line under `## [Unreleased]`:

- New capability → `### Added`; modified behavior → `### Changed`; bug fix → `### Fixed`.
- **Write for end users, not developers** — describe the visible outcome, not entities/services/migrations.
- Prefix with `(beta)` if the feature is behind a flag or not yet exposed in the UI.
- One short line (under 100 chars) per feature/fix.

## 2. Create a branch

Only if checked. First run `git status` and `git branch --show-current`.

- If already on a feature branch (not `main`), keep it and say so — don't create another.
- If on `main`, create and switch to a new branch: `git switch -c <name>`. Derive a short kebab-case name from the changelog entry / diff (e.g. `feat/agent-mcp-servers`). Uncommitted changes carry over to the new branch automatically.

## 3. Run tests-parallel

Only if checked. Run the repo's parallel test target from the root:

```bash
make tests-parallel
```

This spins up the test DB, runs migrations, and runs the API test suite in parallel. If it fails, **stop** and report the failure — do not proceed to the PR. Let the user fix and re-run.

## 4. Create a PR

Only if checked. This requires committed work on a feature branch (not `main`).

1. If there are uncommitted changes, commit them first using Conventional Commits format (see the `commit` skill's conventions).
2. Push the branch: `git push -u origin <branch>`.
3. Open the PR with a heredoc body:
   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   ## Summary
   <what changed and why>

   EOF
   )"
   ```
4. Report the PR URL as a clickable link.

## Notes

- Respect the order: changelog → branch → tests → PR. Never reorder.
- If the user unchecks everything, there is nothing to do — say so.
- If a step's precondition isn't met (e.g. "Create a PR" checked but still on `main` with "Create a branch" unchecked), point out the conflict and ask before proceeding rather than guessing.
