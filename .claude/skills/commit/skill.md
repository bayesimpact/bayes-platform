---
name: commit
description: Stage and commit changes using Conventional Commits format. Analyzes the diff, picks the right type/scope, and writes a concise commit message.
user_invocable: true
---

Create a git commit following the Conventional Commits specification.

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

The scope is **optional** but encouraged. Use the domain or area of the codebase affected:
- Domain module name: `AgentSession`, `Organization`, `Project`, `User`
- Layer: `api`, `web`, `ui`, `api-contracts`
- Infra/tooling: `security`, `docker`, `deps`

Use PascalCase for domain entities, lowercase for layers/infra. If the change spans many areas, omit the scope.

### Summary rules

- Lowercase first letter, no period at the end
- Imperative mood ("add", "fix", "remove", not "added", "fixes", "removed")
- Under 72 characters total for the first line
- Focus on **why/what**, not how

### Body (optional)

For non-trivial changes, add a body after a blank line with bullet points explaining key changes. Use `- ` prefix.

## Steps

1. Run `git status` (never use `-uall`) and `git diff --staged` in parallel. If nothing is staged, also run `git diff` to see unstaged changes.

2. Analyze the diff and determine:
   - The **type** from the table above
   - The **scope** (if applicable)
   - A concise **summary** in imperative mood

3. **Update CHANGELOG.md** when the change needs an entry. `docs/changelog.md` says when, and how to write it. Read it first; this skill copies none of its rules.

4. Copy the commit message to the system clipboard using `pbcopy` via the Bash tool. Use `printf` to build the message (no trailing newline). Format:

```
<type>(<scope>): <summary>

- bullet point details if needed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

5. Tell the user the message is in their clipboard and they can Cmd+V in the WebStorm commit dialog.

## Examples from this repo

```
feat(AgentSession): can delete
fix: show a loader when creating session
ci(security): add gitleaks allowlist
chore: promote changelog for v26.03.1
refactor(api): extract session validation into guard
test(web): add unit tests for project selector
```