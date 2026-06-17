---
name: commit-name
description: Suggest a Conventional Commits message for the last changes without committing. Analyzes the current diff and returns a ready-to-use commit name.
user_invocable: true
---

Propose a commit message for the current changes following the Conventional Commits specification. Do NOT stage, commit, or modify any files — only output the suggested message.

## Conventional Commits Format

```
<type>(<scope>): <short summary>
```

### Types

| Type       | When to use                                              |
|------------|----------------------------------------------------------|
| `feat`     | A new feature or capability                              |
| `fix`      | A bug fix                                                |
| `refactor` | Code change that neither fixes a bug nor adds a feature  |
| `chore`    | Maintenance tasks, dependency updates, config changes    |
| `ci`       | CI/CD pipeline, GitHub Actions, Makefile changes         |
| `docs`     | Documentation only                                       |
| `test`     | Adding or updating tests                                 |
| `perf`     | Performance improvement                                  |
| `style`    | Formatting, whitespace, linting (no logic change)        |
| `core`     | Cross-cutting changes (changelog, versioning)            |

### Scope

Optional but encouraged. Use the domain or area affected:
- Domain module name: `AgentSession`, `Organization`, `Project`, `User`
- Layer: `api`, `web`, `ui`, `api-contracts`
- Infra/tooling: `security`, `docker`, `deps`

Use PascalCase for domain entities, lowercase for layers/infra. If the change spans many areas, omit the scope.

### Summary rules

- Lowercase first letter, no period at the end
- Imperative mood ("add", "fix", "remove", not "added", "fixes", "removed")
- Under 72 characters total for the first line
- Focus on **why/what**, not how

## Steps

1. Run `git status` (never use `-uall`) and `git diff` in parallel to see the changes. If everything is already staged, use `git diff --staged`; if both staged and unstaged exist, look at both.

2. Analyze the diff and determine the **type**, optional **scope**, and a concise **summary** in imperative mood.

3. Output the suggested commit name in a code block so it is easy to copy. For non-trivial changes spanning multiple concerns, add a short body with `- ` bullet points after a blank line.

4. If multiple distinct interpretations are reasonable, offer the best one first, then optionally 1–2 alternatives as a short list.

Do not run any git command that mutates state (`git add`, `git commit`, etc.).

## Examples from this repo

```
feat(AgentSession): can delete
fix: show a loader when creating session
ci(security): add gitleaks allowlist
refactor(api): extract session validation into guard
test(web): add unit tests for project selector
```
