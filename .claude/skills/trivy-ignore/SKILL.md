---
name: trivy-ignore
description: Handle Trivy CVE findings by adding entries to .trivyignore.yaml when no upstream fix is available. Do NOT use npm overrides to work around transitive dependency CVEs — they break cross-platform lockfile entries (e.g. rollup native binaries).
---

When Trivy (or a CI security scan) reports CVEs in JS dependencies with no clear upstream fix, add them to `.trivyignore.yaml` with a short expiry.

## Rules

1. **Never use `npm overrides`** to force-patch transitive dependency versions. Overrides cause `npm install` to regenerate the lockfile for the current platform only, dropping cross-platform optional native binaries (e.g. `@rollup/rollup-linux-x64-gnu`). This breaks CI/Vercel builds on Linux.

2. **Prefer `.trivyignore.yaml`** with a short expiry (30-60 days) for CVEs blocked on upstream package maintainers.

3. **Only apply direct fixes** (e.g. `npm audit fix` without `--force`) if they don't introduce breaking changes.

## Steps

1. Read the current `.trivyignore.yaml` file at the repo root.

2. For each CVE to ignore, add an entry with:
   - `id`: the CVE identifier (e.g. `CVE-2026-33671`)
   - `expired_at`: 30-60 days from today (format: `YYYY-MM-DD`)
   - `reason`: a short explanation — which package, why no fix is available, what's blocking upstream

3. Use the Edit tool to append the new entries under the `vulnerabilities:` key.

4. Verify the YAML is valid by checking indentation matches existing entries (2-space indent, dash-prefixed list items).

## Example entry

```yaml
  - id: CVE-2026-33671
    expired_at: 2026-06-01
    reason: "picomatch — no upstream fix available in transitive deps (jest, vite, angular-devkit)"
```