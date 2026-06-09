# Monthly Dependency Health Check

Run this process monthly to keep dependencies secure and up to date.

## Prerequisites

- Docker running (for image builds and trivy scan)
- Node.js and npm installed
- [Trivy](https://aquasecurity.github.io/trivy/) installed (`brew install trivy`)

## Steps

### 1. Clear trivy ignore list

Remove all entries from `.trivyignore.yaml` to get a fresh vulnerability baseline.

```bash
cp .trivyignore.yaml .trivyignore.yaml.bak
```

Set the file to `vulnerabilities: []`.

### 2. Auto-fix npm vulnerabilities

```bash
npm audit fix --legacy-peer-deps
```

`--legacy-peer-deps` is needed because `@nestjs/typeorm` has a strict peer dependency that hasn't been updated for `@nestjs/core@11.1`.

### 3. Review remaining npm vulnerabilities

```bash
npm audit
```

For each remaining vulnerability, determine if:
- A manual update of the direct dependency fixes it (`npm outdated` helps here)
- It's blocked by an upstream package (add to `.trivyignore.yaml` later)

### 4. Update direct dependencies

```bash
npm outdated
```

Update packages within semver range first:

```bash
npm update --legacy-peer-deps
```

Then update major dependencies individually if needed:

```bash
# Example: update NestJS
cd apps/api && npm install @nestjs/core@latest @nestjs/common@latest @nestjs/platform-express@latest

# Example: update Next.js
cd apps/web && npm install next@latest
```

Prioritize frameworks (NestJS, Next.js) and packages with known CVEs.

### 5. Run tests

```bash
npm run typecheck
npm run biome:check
npx turbo test
```

All three must pass before proceeding.

### 6. Build and scan Docker images

`npm audit` only covers npm packages. Trivy scans the full Docker image including OS packages and Python dependencies (Docling in the workers image).

```bash
make docker-build
make trivy-scan
```

`make trivy-scan` runs trivy against both `caseai-connect/api:local` and `caseai-connect/gpu-workers:local` images with:
- `--ignore-unfixed` — only report CVEs that have a fix available
- `--pkg-types os,library` — scan OS packages and language libraries
- `--severity CRITICAL,HIGH` — ignore low/medium findings
- `--ignorefile .trivyignore.yaml` — skip acknowledged upstream CVEs

If trivy reports new findings, check if the fix is within our control. If blocked by upstream, add to the ignore list (step 7).

### 7. Re-populate `.trivyignore.yaml`

For each vulnerability that cannot be fixed (blocked by upstream), add an entry with a 1-month expiry:

```yaml
vulnerabilities:
  - id: CVE-XXXX-XXXXX
    expired_at: 2026-05-01  # next monthly check
    reason: "package X.Y.Z — fix in X.Y.W, blocked by <upstream dep>"
```

Verify the scan passes with the updated ignore list:

```bash
make trivy-scan
```

Remove the backup: `rm .trivyignore.yaml.bak`

### 8. Commit

```bash
git add package-lock.json .trivyignore.yaml apps/api/package.json apps/web/package.json
```

Use commit message: `chore(deps): monthly dependency update`

## What trivy scans vs npm audit

| Tool | Scope | Runs on |
|------|-------|---------|
| `npm audit` | npm dependency tree only | `node_modules` |
| `trivy` | OS packages + npm + Python (pip) + Go + more | Docker image |

Both are needed. `npm audit` catches JS-only CVEs faster, but trivy catches vulnerabilities in the full container stack (e.g. torch/Docling Python deps, Debian OS packages).
