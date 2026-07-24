# Bayes Impact

Bayes Impact is a technology nonprofit organization building AI recommendation systems for the public interest.
As part of this work, we curate public and community resource datasets and make them usable by AI agents.

Product updates: https://bayesimpact.notion.site/bayes-platform-product-updates

# AgentStudio

![Security](https://github.com/bayesimpact/caseai-connect/actions/workflows/security.yml/badge.svg)

A SaaS platform for building multi-agent systems, built as a Turbo monorepo with a NestJS API and a React web frontend using Auth0 for authentication.

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

# Langfuse (optional, for AI observability)
LANGFUSE_SK=XXX
LANGFUSE_PK=XXX
LANGFUSE_BASE_URL=XXX

# Database
DATABASE_URL=postgresql://admin:passpass@localhost:5432/caseai_connect

# Auth0
AUTH0_ISSUER_URL=https://your-tenant.auth0.com/
AUTH0_AUDIENCE=https://your-tenant.auth0.com/api/v2/

# Auth0 Invitations
AUTH0_ORGANIZATION_ID=org_XXX
AUTH0_CLIENT_ID=XXX
AUTH0_M2M_CLIENT_ID=XXX
AUTH0_M2M_CLIENT_SECRET=XXX
```

**Required variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH0_ISSUER_URL` - Auth0 issuer URL
- `AUTH0_AUDIENCE` - Auth0 API audience
- `AUTH0_ORGANIZATION_ID` - Auth0 organization ID (single org, see ADR-0001)
- `AUTH0_CLIENT_ID` - Auth0 web SPA application client ID (used in invitation links)
- `AUTH0_M2M_CLIENT_ID` - Auth0 M2M application client ID (for Management API)
- `AUTH0_M2M_CLIENT_SECRET` - Auth0 M2M application client secret

**Optional variables:**
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Google Cloud service account key (for AI features)
- `LANGFUSE_*` - Langfuse configuration (for AI observability)

#### Web Environment Variables

```bash
cd apps/web
cp .env-example .env
```

Edit `.env`:

```bash
VITE_API_URL=http://localhost:3000

# Auth0
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=XXX
VITE_AUTH0_AUDIENCE=https://your-tenant.auth0.com/api/v2/
```

**Optional — in-platform help chat:**

Set these two variables to embed a floating help chat bubble inside the Studio. The bubble uses the AgentStudio embed widget, so the target agent must have its embed config enabled and `VITE_AGENT_EMBED_URL`'s origin listed in `allowedOrigins`.

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

The repository ships defaults (coral accent). To rebrand for a specific deployment, replace these files before building — no env vars or code changes needed.

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

**Migration Commands:**

- `npm run migration:run` - Run all pending migrations
- `npm run migration:revert` - Revert the last migration
- `npm run migration:show` - Show migration status
- `npm run migration:generate -- -n MigrationName` - Generate a new migration from entity changes
- `npm run migration:create -- migrations/MigrationName` - Create an empty migration file

### 5. Set Up HTTPS with `connect.localhost` (Recommended)

The invitation flow requires Auth0 redirects that work best with a stable local domain and HTTPS. Both the API and web app auto-detect certificates and enable HTTPS when they are present.

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
VITE_API_URL=https://connect.localhost:3000
```

**Auth0 Dashboard:**

- Update **Application Login URI** to `https://connect.localhost:5173`
- Update **Allowed Callback URLs** to include `https://connect.localhost:5173`
- Update **Allowed Logout URLs** to include `https://connect.localhost:5173`
- Update **Allowed Web Origins** to include `https://connect.localhost:5173`

### 6. Run the Projects Locally

#### Run All Projects (Development Mode)

From the root:

```bash
npm run dev
```

This will start all apps in watch mode using Turbo.

- **With HTTPS** (certs present): API at `https://connect.localhost:3000`, web at `https://connect.localhost:5173`
- **Without HTTPS** (no certs): API at `http://localhost:3000`, web at `http://localhost:5173`

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
- [Auth0 Documentation](https://auth0.com/docs)

## Citing & credit

Publishing about agents you built on the **Bayes Platform**? Please **cite** it and
add a one-line **acknowledgment** — see
[`CITING.md`](CITING.md). Using the platform doesn't require co-authorship; `CITING.md`
explains when co-authorship is (and isn't) appropriate. GitHub's "Cite this repository"
button (from [`CITATION.cff`](CITATION.cff)) exports a ready BibTeX/APA citation.
