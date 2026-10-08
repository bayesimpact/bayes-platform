# Bayes Impact

Bayes Impact is a technology nonprofit organization building AI recommendation systems for the public interest.
As part of this work, we curate public and community resource datasets and make them usable by AI agents.

# Bayes platform

![Security](https://github.com/bayesimpact/caseai-connect/actions/workflows/security.yml/badge.svg)
[![DOI](https://zenodo.org/badge/1198631787.svg?v=1)](https://doi.org/10.5281/zenodo.21533360)

A SaaS platform for building multi-agent systems, built as a Turbo monorepo with a NestJS API and a React web frontend. Users sign in through any OpenID Connect provider (Keycloak, Dex, Auth0, Okta...).

## Prerequisites

- **Node.js** >= 18
- **npm** >= 10.5.0 (or the version specified in `package.json`)
- **Docker** and **Docker Compose** (for local database)
- **PostgreSQL** (via Docker, see below)

## Getting Started

### 1. Install Dependencies

From the root of the repository:

```bash
npm install
```

This will install dependencies for all workspaces (apps and packages).

### 2. Set Up the Database

The project uses PostgreSQL with pgvector extension. The easiest way to run it locally is via Docker Compose.

#### Start the Database

```bash
cd infra/database
docker compose up -d
```

This will:
- Start a PostgreSQL 17 container with pgvector extension
- Create two databases:
  - `caseai_connect` (main database)
  - `caseai_connect_test` (test database)
- Expose PostgreSQL on port `5432`

**Database Credentials:**
- Host: `localhost`
- Port: `5432`
- User: `admin`
- Password: `passpass`
- Main Database: `caseai_connect`
- Test Database: `caseai_connect_test`

#### Grafana on the analytics schema (optional)

The compose stack also has a Grafana at [http://localhost:3300](http://localhost:3300)
(no login) with the `Platform activity` dashboard on the `analytics` schema:
activity per workspace, never a user or a conversation (see
[docs/analytics-schema.md](docs/analytics-schema.md)). The datasource is
provisioned from `infra/database/grafana`, the dashboards are the JSON files of
`deploy/helm/bayes-platform/dashboards`, the same the chart ships to the cluster;
a change made in the UI is lost at the next start, export the JSON and commit it.
It reads the `connect` database, or the one named by `GRAFANA_DATABASE` in
`infra/database/.env`.

```bash
cd infra/database
docker compose up -d --no-recreate grafana   # --no-recreate keeps the running database untouched
cd ../.. && make analytics-dev-role          # once, after the migrations: the read-only role Grafana uses
```

#### LLM traces in Phoenix (optional)

An OpenTelemetry Collector (`deploy/helm/bayes-platform/files/otel-collector.yaml`, the same traces
pipeline as the gateway of the clusters) and Phoenix at
[http://localhost:6060](http://localhost:6060) (port 6006 belongs to the web
app's Storybook). Start them, then set in `apps/api/.env`:
`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` and
`TRACE_URL_TEMPLATE=http://localhost:6060/redirects/sessions/{traceId}`.

```bash
cd infra/database
docker compose --profile traces up -d --no-recreate otel-collector phoenix
```

#### Invitation emails in Mailpit (optional)

Mailpit is a fake SMTP server: it catches every email and sends none. The
invitation emails show up at [http://localhost:8025](http://localhost:8025).
Start it, then set in `apps/api/.env`: `SMTP_HOST=localhost`, `SMTP_PORT=1025`
and `SMTP_FROM=Platform <no-reply@connect.localhost>`. Without `SMTP_HOST` the
API sends no email.

```bash
cd infra/database
docker compose --profile mail up -d --no-recreate mailpit
```

#### Profiles of the dev stack

`infra/database/docker-compose.yaml` is the one compose project of the local
stack (`connect-db`). A plain `docker compose up -d` starts pgvector and redis;
the other services start with their profile, from `infra/database`:

| Profile | Services | Start |
|---|---|---|
| (default) | pgvector, redis | `docker compose up -d` |
| `mail` | Mailpit, http://localhost:8025 | `docker compose --profile mail up -d --no-recreate mailpit` |
| `keycloak` | Keycloak, http://localhost:8080 ([README](infra/keycloak/README.md)) | `docker compose --profile keycloak up -d --no-recreate keycloak` |
| `dex` | Dex, http://localhost:5556 ([README](infra/dex/README.md)) | `docker compose --profile dex up -d --no-recreate dex` |
| `traces` | otel-collector, Phoenix, http://localhost:6060 | `docker compose --profile traces up -d --no-recreate otel-collector phoenix` |
| `analytics` | Grafana, http://localhost:3300 | `docker compose --profile analytics up -d --no-recreate grafana` |

Keycloak and Dex used to have their own compose projects. If one of them still
runs from there, stop it once before starting it with its profile:
`docker compose -p connect-keycloak down` or `docker compose -p connect-dex down`.

Every service of the stack restarts with Docker after a reboot, until you stop
it with `docker compose stop <service>`. Postgres accepts 500 connections, for
the main checkout, worktree environments and parallel test runs at once.

#### Stop the Database

```bash
cd infra/database
docker compose down
```

#### View Database Logs

```bash
cd infra/database
docker compose logs -f
```

### 3. Configure Environment Variables

#### API Environment Variables

Copy the example environment file:

```bash
cd apps/api
cp .env-example .env
```

Edit `.env` with your configuration:

```bash
# Timezone
TZ='UTC'

# Google Cloud (optional, for AI features)
GOOGLE_APPLICATION_CREDENTIALS=../../dontsave/caseai-connect-XXX.json

# OpenTelemetry (optional, for traces and metrics)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
TRACE_URL_TEMPLATE=https://traces.example.org/redirects/sessions/{traceId}

# Database
DATABASE_URL=postgresql://admin:passpass@localhost:5432/caseai_connect

# OpenID Connect provider (local Dex: see infra/dex/README.md)
OIDC_ISSUER_URL=http://localhost:5556/dex
WEB_OIDC_CLIENT_ID=platform-web
```

**Required variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `OIDC_ISSUER_URL` - Issuer of the OpenID Connect provider, equal to the `iss` claim of the access tokens
- `OIDC_AUDIENCE` - Expected `aud` claim, when the provider sets one
- `APPS_JWT_PRIVATE_KEY` / `APPS_JWT_PUBLIC_KEY` - RS256 PEM pair used to sign App access tokens (literal `\n` is accepted)

**Optional variables:**
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Google Cloud service account key (for AI features)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OpenTelemetry Collector that receives traces and metrics over OTLP (nothing is exported when unset)
- `TRACE_URL_TEMPLATE` - Link to a trace in the trace backend, `{traceId}` is replaced by our trace id
- `OIDC_ALLOW_EMAIL_LINKING` / `OIDC_TRUST_UNVERIFIED_EMAIL` - How a first sign-in is linked to the account of someone invited by email (see [ADR 0021](docs/adr/0021-generic-oidc-and-access-by-email.md))
- `OIDC_AUTHORIZATION_PARAMS` - Extra authorize parameters as a JSON object, for example `{"organization":"org_XXX"}` for an Auth0 organization

Upgrading a `.env` from Auth0: see [docs/upgrading/auth0-to-oidc.md](docs/upgrading/auth0-to-oidc.md).

**Local sign-in:** start Dex (`docker compose --profile dex up -d --no-recreate dex` from
`infra/database`), then run `node infra/dex/sync-users.mjs` from the main checkout. Every person of
your local database gets a Dex account with their email and a local dev password, and keeps their
data. See [infra/dex/README.md](infra/dex/README.md).

#### Web Environment Variables

```bash
cd apps/web
cp .env-example .env
```

Edit `.env`:

```bash
# The private API lives under /api on the API origin
VITE_API_URL=http://localhost:3000/api

# OpenID Connect provider and the public client of the web app
VITE_OIDC_AUTHORITY=http://localhost:5556/dex
VITE_OIDC_CLIENT_ID=platform-web
```

**Optional — in-platform help chat:**

Set these two variables to embed a floating help chat bubble inside the Studio. The bubble uses the Bayes platform embed widget, so the target agent must have its embed config enabled and `VITE_AGENT_EMBED_URL`'s origin listed in `allowedOrigins`.

| Variable | Description |
|---|---|
| `VITE_HELP_AGENT_EMBED_TOKEN` | Embed token of the help agent (found in the agent's Embed tab in the Studio). When absent, no bubble is shown. |
| `VITE_HELP_AGENT_EMBED_COLOR` | Optional hex color for the launcher button (e.g. `#f18c6e`). Falls back to the launcher's default when not set. |

#### Theming

Visual branding (logo, favicon, primary color) is controlled by static files in `apps/web/public/theme/`:

| File | Purpose |
|------|---------|
| `theme.css` | CSS overrides — primarily `--primary` (the accent color used across the UI) |
| `logo.svg` | Logo displayed in the sidebar, navbar, and onboarding screen |
| `favicon.svg` | Browser tab icon |

The repository ships a dev default (purple accent, placeholder logo). The browser reads the three files at runtime, so a deployment replaces them without rebuilding: the Helm chart mounts them from `web.theme`, a static host copies them over `dist/theme/`. No env vars or code changes needed.

The help center (`apps/help`) works the same way with one file, `apps/help/public/theme/theme.css`, which sets `--brand-primary` (the accent of its feature walkthroughs); the chart mounts it from `help.theme`.

### 3.1 Install Docling for Worker Extraction (macOS, Linux, Windows)

The embedding worker uses Docling in-process for document extraction.

- Extraction logic: `apps/api/src/domains/documents/embeddings/document-text-extractor.service.ts`
- Worker startup health check: `apps/api/src/workers-main.ts`
- Shared Docling helpers: `apps/api/src/external/docling`

Install Docling on your machine so `docling` is available in `PATH`.

**macOS**

```bash
python3 --version
python3 -m pip install --upgrade pip
python3 -m pip install docling
docling --version
```

**Linux**

```bash
python3 --version
python3 -m pip install --upgrade pip
python3 -m pip install docling
docling --version
```

If your distro blocks global Python installs, use a virtual environment:

```bash
python3 -m venv .venv-docling
source .venv-docling/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install docling
docling --version
```

**Windows (PowerShell)**

```powershell
py --version
py -m pip install --upgrade pip
py -m pip install docling
docling --version
```

If `docling` is not recognized, restart the terminal and make sure your Python Scripts directory is in `PATH`.

Docling-related environment variables:

- `DOCUMENT_EXTRACTOR_DOCLING_ENABLED` (default: `true`)
- `DOCUMENT_CHUNKER_COMMAND` (optional path override for `apps/api/bin/document_chunker`)
- `DOCUMENT_EXTRACTOR_DOCLING_TIMEOUT_MS` (default: `60000` for extraction; worker health check uses `10000` fallback if unset)

### 4. Run Database Migrations

Before running the API, you need to apply database migrations:

```bash
cd apps/api
npm run migration:run
```

This will apply all pending migrations to the `caseai_connect` database.

The analytics migration creates a database role, which needs `CREATEROLE` on the
migration user. A database created from the current `infra/database/sql/common.sql`
has it. One created before that line does not: init scripts do not run again, and
the migration fails with `permission denied to create role`. Grant it once, then
run the migration again:

```bash
make db-grant-createrole
```

**Migration Commands:**

- `npm run migration:run` - Run all pending migrations
- `npm run migration:revert` - Revert the last migration
- `npm run migration:show` - Show migration status
- `npm run migration:generate -- -n MigrationName` - Generate a new migration from entity changes
- `npm run migration:create -- migrations/MigrationName` - Create an empty migration file

### 5. Set Up HTTPS with `connect.localhost` (Recommended)

OIDC redirects work best with a stable local domain and HTTPS. Both the API and web app auto-detect certificates and enable HTTPS when they are present.

#### 5.1 No hosts-file update needed

You do **not** need to update your hosts file:

- **macOS / Linux**: no `/etc/hosts` change required
- **Windows**: no `%SystemRoot%\System32\drivers\etc\hosts` change required

#### 5.2 Generate a self-signed certificate

Create the certificate directory and generate a certificate valid for both `localhost` and `connect.localhost`:

**Windows:**: install openssl if not already installed (by ex from :https://slproweb.com/products/Win32OpenSSL.html)

```bash
mkdir -p apps/api/.certs

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout apps/api/.certs/key.pem \
  -out apps/api/.certs/cert.pem \
  -days 365 \
  -subj "/CN=connect.localhost" \
  -addext "subjectAltName=DNS:connect.localhost,DNS:localhost,IP:127.0.0.1,IP:::1"
```

> **Note**: The `.certs/` directory is shared between the API and the web app. Vite reads certs from `apps/api/.certs/` (see `apps/web/vite.config.ts`). The `*.pem` files are already in `.gitignore`.

#### 5.3 Trust the certificate on your system

Browsers reject self-signed certificates by default. You need to add the certificate to your system's trust store.

**macOS:**

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  apps/api/.certs/cert.pem
```

After running this command, restart your browser. The certificate will be trusted system-wide.

**Windows:**

```powershell as administrator
certutil.exe -addstore -f "Root" "./apps/api/.certs/cert.pem"
Import-Certificate -FilePath "<SET ROOT HERE>\apps\api\.certs\cert.pem" -CertStoreLocation "Cert:\LocalMachine\Root"
```
Then restart your computer

**Linux (Ubuntu/Debian):**

```bash
sudo cp apps/api/.certs/cert.pem /usr/local/share/ca-certificates/connect-localhost.crt
sudo update-ca-certificates
```

> **Tip**: If you see "Your connection is not private" in Chrome after trusting the cert, try visiting `https://connect.localhost:3000` directly in the browser first and accepting the certificate, then reload the web app.

#### 5.4 Update environment variables for HTTPS

Once HTTPS is set up, update your `.env` files to use `https://connect.localhost`:

**`apps/web/.env`:**

```bash
VITE_API_URL=https://connect.localhost:3000/api
```

**Identity provider:** the web app client must allow `https://connect.localhost:5173` as redirect URI, post-logout redirect URI and web origin. The local Dex does, and `node infra/dex/sync-users.mjs` adds every origin of `FRONTEND_URL`.

### 6. Run the Projects Locally

#### Run All Projects (Development Mode)

From the root:

```bash
npm run dev
```

This will start all apps in watch mode using Turbo.

- **With HTTPS** (certs present): API at `https://connect.localhost:3000`, web at `https://connect.localhost:5173`
- **Without HTTPS** (no certs): API at `http://localhost:3000`, web at `http://localhost:5173`
- **API paths**: the private API is served under `/api` (`/api/healthz`, `/api/organizations/...`) and the public chat API under `/public`. `/public` is the stable public surface: an incompatible change would become `/public/v1`, never a move under `/api`. In the `app` image the web front is served at `/` on the same origin.
- **PDF converter** (Go): `http://localhost:3002`, with the PDF export MCP endpoint at `/mcp`. Started when Go is installed and `apps/pdf-converter/.env` exists (copy `.env-example`), skipped otherwise. See [apps/pdf-converter/README.md](apps/pdf-converter/README.md).
- **Apps CLI**: install an app from the terminal with `npx bayes`. See [apps/cli/README.md](apps/cli/README.md).

#### Run Individual Projects

**API:**

```bash
cd apps/api
npm run dev
```

**Web frontend:**

```bash
cd apps/web
npm run dev
```

#### Storybook

Each front end has its own Storybook, which renders screens and components with sample data, without the API or a login:

| Package | Command | URL |
|---------|---------|-----|
| `apps/web` | `cd apps/web && npm run storybook` | `http://localhost:6006` |
| `apps/web-embed` | `cd apps/web-embed && npm run storybook` | `http://localhost:6007` |
| `packages/ui` | `cd packages/ui && npm run storybook` | `http://localhost:6008` |

#### Storybook MCP servers for Claude Code

`.mcp.json` declares two MCP servers, served by the Storybook MCP addon: `storybook-web` (`apps/web`, port 6006) and `storybook-ui` (`packages/ui`, port 6008). They let Claude Code read component docs, find the stories of a changed file and link to a story. The `storybook-screenshot` skill uses them alongside its own screenshot script.

1. Approve both servers when Claude Code asks, the first time you open the repo, or later from `/mcp`.
2. Start the matching Storybook: a server only connects while its Storybook runs.
3. If Storybook started after Claude Code, reconnect the server from `/mcp`.

If you had registered them yourself with `claude mcp add`, remove those copies with `claude mcp remove storybook-web -s local` (and `storybook-ui`): a local entry overrides the shared one.

### Docker Smoke Test (API + Workers + PG + Redis)

Use this when you want to validate that both runtime images boot correctly with Postgres and Redis.

From the repository root:

```bash
# Build images and start smoke stack
make docker-smoke-up PROJECT=connect REGION=eu

# Check service status and fail if api/workers exited
make docker-smoke-check PROJECT=connect REGION=eu

# Inspect logs
make docker-smoke-logs PROJECT=connect REGION=eu

# Tear down stack and volumes
make docker-smoke-down PROJECT=connect REGION=eu
```

Notes:

- The smoke stack is defined in `infra/docker-compose.api-workers-smoke.yaml`.
- API uses Docker target `api-runtime`; workers ship as two images — `cpu-workers-runtime` (no Docling) and `gpu-workers-runtime` (Docling). Both run the same entrypoint; queue selection is per-instance via `WORKER_QUEUE_NAMES`.
- Smoke stack ports:
  - API: `http://localhost:3003`
  - Postgres: `localhost:55432`
  - Redis: `localhost:56379`

### Deploy on Kubernetes

A Helm chart installs the full platform (API, workers, front ends, PDF converter) on any Kubernetes cluster, with bundled Postgres and Redis or with managed services. See [deploy/helm/bayes-platform/README.md](deploy/helm/bayes-platform/README.md).

Global roles are granted by an operator, never at sign-in: `platformSuperadmins` in the chart values (grant only, applied at every upgrade), then `npm run platform-role -- grant|revoke|list --email <email> [--role <role>]` (or the same script from the runtime image).

## Running Tests

### Run All Tests

From the root:

```bash
npm run test
```

### Run API Tests

```bash
cd apps/api
npm test
```

### Run Tests in Watch Mode

```bash
cd apps/api
npm run test:watch
```

### Run E2E Tests

From the root:

```bash
npm run test:e2e
```

Or from the API directory:

```bash
cd apps/api
npm run test:e2e
```

### Test Database Setup

The test database (`caseai_connect_test`) is automatically created when you start the Docker Compose service. Before running tests, make sure migrations are applied to the test database:

```bash
cd apps/api
npm run migration:test:run
```

**Test Migration Commands:**

- `npm run migration:test:run` - Run migrations on test database
- `npm run migration:test:revert` - Revert last migration on test database
- `npm run migration:test:show` - Show migration status on test database

**Note:** Tests use a separate database (`caseai_connect_test`) to avoid interfering with development data. The test database configuration is loaded from `apps/api/.env.test` (if it exists) or uses the same connection string with a different database name.

## Creating Migrations

### Generate Migration from Entity Changes

If you've modified TypeORM entities and want TypeORM to generate the migration automatically:

```bash
cd apps/api
npm run migration:generate -- -n MigrationName
```

This will create a new migration file in `apps/api/src/migrations/` based on the differences between your entities and the current database schema.

**Example:**

```bash
npm run migration:generate -- -n AddUserEmailIndex
```

### Create Empty Migration

If you need to write a custom migration manually:

```bash
cd apps/api
npm run migration:create -- migrations/AddCustomFeature
```

This creates an empty migration file that you can fill in with your custom SQL or TypeORM migration code.

**Example Migration Structure:**

```typescript
import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddCustomFeature1234567890000 implements MigrationInterface {
  name = "AddCustomFeature1234567890000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Your migration code here
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Your rollback code here
  }
}
```

### Migration Best Practices

1. **Always test migrations** on the test database first:
   ```bash
   npm run migration:test:run
   ```

2. **Check migration status** before applying:
   ```bash
   npm run migration:show
   ```

3. **Write reversible migrations** - always implement the `down()` method to allow rollbacks.

4. **Use transactions** - TypeORM runs migrations in transactions by default, so if a migration fails, it will be rolled back.

5. **Test rollbacks**:
   ```bash
   npm run migration:revert
   ```

## Code Quality

### Linting and Formatting

From the root:

```bash
# Check and auto-fix linting and formatting issues
npm run biome:check

# Check only (CI mode)
npm run biome:ci

# Format only
npm run format
```

### Type Checking

From the root:

```bash
npm run typecheck
```

## Project Structure

```
caseai-connect/
├── apps/
│   ├── api/              # NestJS API
│   ├── web/              # React web frontend
│   └── mcp-server/       # MCP server for Claude Desktop
├── packages/
│   ├── api/              # Shared API types and DTOs
│   ├── jest-config/      # Shared Jest configuration
│   ├── typescript-config/# Shared TypeScript configuration
│   └── ui/               # Shared UI components
├── infra/
│   └── database/         # Docker Compose setup for PostgreSQL
└── package.json          # Root package.json with workspace scripts
```

## Troubleshooting

### Database Connection Issues

1. **Check if Docker is running:**
   ```bash
   docker ps
   ```

2. **Verify database is accessible:**
   ```bash
   psql postgresql://admin:passpass@localhost:5432/caseai_connect
   ```

3. **Check database logs:**
   ```bash
   cd infra/database
   docker compose logs -f
   ```

### Migration Issues

1. **Migration fails to run:**
   - Check that the database is running
   - Verify `DATABASE_URL` in `.env` is correct
   - Check migration files for syntax errors

2. **Migration already applied:**
   - Check migration status: `npm run migration:show`
   - If needed, revert and re-run: `npm run migration:revert && npm run migration:run`

### HTTPS / Certificate Issues

1. **"Your connection is not private" in Chrome:**
   - Make sure you trusted the certificate (see step 5.3)
   - Try visiting `https://connect.localhost:3000` directly and accepting the certificate
   - Restart your browser after trusting the certificate
   - On macOS, verify the cert is trusted: `security find-certificate -c "connect.localhost" /Library/Keychains/System.keychain`

2. **CORS errors with `https://connect.localhost`:**
   - The API's CORS config already allows `https://connect.localhost:5173`. If you still get CORS errors, the browser may be blocking the request because it doesn't trust the API's certificate.
   - Visit `https://connect.localhost:3000` directly and accept the certificate, then reload the web app.

3. **Certificate expired:**
   - Regenerate the certificate (step 5.2) and re-trust it (step 5.3).

4. **App falls back to HTTP:**
   - Make sure the cert files exist at `apps/api/.certs/key.pem` and `apps/api/.certs/cert.pem`.
   - Both the API (`main.ts`) and web (`vite.config.ts`) auto-detect certs — if the files are missing, they silently fall back to HTTP.

### Port Already in Use

If port 3000 is already in use:

1. Find the process using the port:
   ```bash
   lsof -i :3000
   ```

2. Kill the process or change the port in `apps/api/src/main.ts`

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)

## Citing & credit

Publishing about agents you built on the **Bayes Platform**? Please **cite** it and
add a one-line **acknowledgment** — see
[`CITING.md`](CITING.md). Using the platform doesn't require co-authorship; `CITING.md`
explains when co-authorship is (and isn't) appropriate. GitHub's "Cite this repository"
button (from [`CITATION.cff`](CITATION.cff)) exports a ready BibTeX/APA citation.
