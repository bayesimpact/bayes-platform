/**
 * Registers an app and its OAuth client (ADR 0029), without the back-office: for scripts, dev
 * tooling and fresh installs.
 *
 *   app-client register --slug my-app --name "My App" \
 *     --permission agent.read [--permission ...] \
 *     --redirect-uri https://my-app.example.org/api/bayes/callback [--redirect-uri ...] \
 *     [--description "..."]
 *
 * From the sources: `npm run app-client -w apps/api -- register ...`
 * From the runtime image: node /app/apps/api/dist/scripts/app-client.js register ...
 *
 * It creates the manifest, or adds the redirect URIs and permissions to the ones it has (its name
 * and description stay). Then it creates the app's OAuth client, or replaces its secret: with
 * APP_CLIENT_SECRET when set, so that an app keeps the secret it runs with, else a new one.
 * It prints `{"clientId": "...", "clientSecret": "..."}` on stdout, and nothing else there.
 */
import { NestFactory } from "@nestjs/core"
import { AppModule } from "@/app.module"
import { AppsService } from "@/domains/apps/apps.service"
import { generateClientSecret } from "@/domains/apps/client-credentials"
import { OAuthClientsService } from "@/domains/oauth/oauth-clients.service"

type Arguments = {
  slug: string
  name: string
  description: string | null
  permissions: string[]
  redirectUris: string[]
}

function usage(message?: string): never {
  // stderr: stdout carries the client alone.
  if (message) process.stderr.write(`${message}\n`)
  process.stderr.write(
    "Usage: app-client register --slug <slug> --name <name> --permission <permission>... --redirect-uri <uri>... [--description <text>]\n",
  )
  process.exit(2)
}

function readArguments(argv: string[]): Arguments {
  const [command, ...rest] = argv
  if (command !== "register") usage()
  const values = new Map<string, string[]>()
  for (let index = 0; index < rest.length; index += 2) {
    const optionName = rest[index]
    const optionValue = rest[index + 1]
    if (!optionName?.startsWith("--") || optionValue === undefined)
      usage(`Bad option: ${optionName}`)
    const key = optionName.slice(2)
    values.set(key, [...(values.get(key) ?? []), optionValue])
  }
  const single = (key: string) => values.get(key)?.at(-1)?.trim() || null
  const slug = single("slug")
  const name = single("name")
  if (!slug || !name) usage("--slug and --name are required")
  const permissions = values.get("permission") ?? []
  const redirectUris = values.get("redirect-uri") ?? []
  if (permissions.length === 0 || redirectUris.length === 0) {
    usage("At least one --permission and one --redirect-uri")
  }
  return { slug, name, description: single("description"), permissions, redirectUris }
}

async function main(): Promise<void> {
  const fields = readArguments(process.argv.slice(2))
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] })
  try {
    const manifest = await app.get(AppsService).registerAppManifest({
      slug: fields.slug,
      name: fields.name,
      description: fields.description,
      logoUrl: null,
      grantablePermissions: fields.permissions,
      allowedRedirectUris: fields.redirectUris,
    })
    const client = await app
      .get(OAuthClientsService)
      .setAppClientSecret(manifest.id, process.env.APP_CLIENT_SECRET || generateClientSecret())
    process.stdout.write(`${JSON.stringify(client)}\n`)
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
