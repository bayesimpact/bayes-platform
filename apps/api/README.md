# With-NestJs | API

## Getting Started

First, run the development server:

```bash
npm run dev
```

By default, your server will run at [http://localhost:3000](http://localhost:3000). You can use your favorite API platform like [Insomnia](https://insomnia.rest/) or [Postman](https://www.postman.com/) to test your APIs

You can start editing the demo **APIs** by modifying [linksService](./src/links/links.service.ts) provider.

### ⚠️ Note about build

If you plan to only build this app. Please make sure you've built the packages first.

## Learn More

To learn more about NestJs, take a look at the following resources:

- [Official Documentation](https://docs.nestjs.com) - A progressive Node.js framework for building efficient, reliable and scalable server-side applications.
- [Official NestJS Courses](https://courses.nestjs.com) - Learn everything you need to master NestJS and tackle modern backend applications at any scale.
- [GitHub Repo](https://github.com/nestjs/nest)

## Scripts

Admin scripts live in `src/scripts/` and are exposed as npm commands. They all bootstrap a full NestJS application context, so database and external service configuration must be available via environment variables.

### Environment loading

All scripts support `DOTENV_CONFIG_PATH` to load a specific `.env` file before the NestJS app bootstraps. This is useful for targeting a specific environment (e.g. platform):

```bash
DOTENV_CONFIG_PATH=.env.dontsave.platform npm run invite:manage
```

When `DOTENV_CONFIG_PATH` is set, the specified file is loaded with `override: true`, meaning its values take precedence over any previously set environment variables.

### Available scripts

| Command | Description |
|---|---|
| `npm run provision:organization-owners` | Create organizations and give their owners admin access by email, from a CSV file (`--file <path>` required, supports `--dry-run`) || `npm run seed:mcp-preset` | Create an MCP server preset interactively |
| `npm run mcp:link-to-project` | Link an MCP server preset to project agents interactively |
| `npm run requeue:document-embeddings` | Re-enqueue documents for embedding generation (supports `--dry-run`, `--limit`, `--batch-size`, `--organization-id`, `--project-id`, `--all-project-documents`) |

## Force API Deployment (No TS Changes)

Production CI only deploys when `make check-api-changes` finds meaningful API changes.
If you need to trigger deployment without touching TypeScript code:

```bash
sed -i '' "s/^force-deploy: .*/force-deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)/" apps/api/src/.deploy-trigger
```

Then commit and push the change.
