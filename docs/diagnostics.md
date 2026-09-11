# Diagnostics Endpoint

The API exposes a secret-gated diagnostics endpoint used to verify that error reporting (Sentry, GCP Error Reporting, etc.) is wired up correctly end-to-end.

## Endpoint

```
GET /diagnostics/:secret/test-error
```

- `:secret` must match the `DIAGNOSTICS_SECRET` environment variable.
- On match: throws an uncaught `Error("Diagnostics test error — verifying error reporting pipeline")`, resulting in a `500` response. This is the error that should surface in the error reporter.
- On mismatch or when `DIAGNOSTICS_SECRET` is unset: returns `404` (indistinguishable from a missing route, to avoid leaking the endpoint's existence).

Source: `apps/api/src/common/diagnostics/diagnostics.controller.ts`.

## Configuration

Set `DIAGNOSTICS_SECRET` in the API environment. Treat it like any other secret — long, random, per-environment.

```bash
# apps/api/.env
DIAGNOSTICS_SECRET=$(openssl rand -hex 32)
```

Leaving `DIAGNOSTICS_SECRET` unset in production effectively disables the endpoint (all requests return 404).

## Usage

```bash
curl -i "http://localhost:3000/api/diagnostics/$DIAGNOSTICS_SECRET/test-error"
```

Expected: HTTP 500, plus one new error in whichever reporter the environment is wired to.

## When to run it

- After deploying a new environment, to confirm errors are being captured.
- After changing error-reporter configuration (DSN, sampling, transport).
- As part of incident response, if you suspect the reporter has gone silent.

## Security notes

- The endpoint is not behind `JwtAuthGuard` by design — it must be reachable without a user session so it can be hit from a smoke-test script or a browser in any environment.
- Anyone who knows the secret can trigger an error report. Rotate the secret if it leaks; you will see spurious errors in your reporter until you do.
- The 404-on-mismatch behavior means the endpoint does not announce itself to scanners.