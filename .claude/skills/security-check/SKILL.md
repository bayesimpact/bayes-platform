---
name: security-check
description: Run Trivy vulnerability scan on Docker images (API, CPU workers, GPU workers). Builds images, scans for CRITICAL/HIGH CVEs, and reports findings.
user_invocable: true
---

Run a local Trivy security scan matching the CI pipeline configuration.

## Steps

1. Run `make trivy-scan` from the repo root using the Bash tool. This will:
   - Build the Docker images (`caseai-connect/api:local`, `caseai-connect/cpu-workers:local`, and `caseai-connect/gpu-workers:local`)
   - Scan all three images with Trivy for CRITICAL and HIGH vulnerabilities
   - Apply `.trivyignore.yaml` exclusions

2. If the scan **passes** (exit code 0): report that no unignored CRITICAL/HIGH vulnerabilities were found.

3. If the scan **fails** (exit code 1): parse the Trivy output and for each CVE found:
   - List the CVE ID, severity, package name, installed version, and fixed version (if available)
   - Indicate whether a fix is available upstream
   - Suggest next steps:
     - If a direct dependency can be updated: suggest the `npm update` or `npm install` command
     - If blocked on a transitive dependency with no fix: suggest using the `/trivy-ignore` skill to add it to `.trivyignore.yaml`
     - If a major version bump is needed: flag it for manual review