// Starts the Go pdf-converter service for `npm run dev`, alongside the Node apps.
//
// The service reads its configuration from environment variables only, so this
// launcher reuses the two values the API already keeps in apps/api/.env
// (bucket and service-account key) and listens on PDF_CONVERTER_PORT (default 3002),
// which is where apps/api/.env points PDF_CONVERTER_URL. Both `.env` files live in
// `apps/<app>/`, so a relative GOOGLE_APPLICATION_CREDENTIALS path resolves the same
// from here as from the API.
//
// Missing prerequisites (no Go toolchain, no bucket configured) print a warning and
// exit 0, so `npm run dev` still brings up the API and the web app.
import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

const serviceDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const apiEnvFile = resolve(serviceDir, "../api/.env")
const inheritedFromApi = ["GCS_STORAGE_BUCKET_NAME", "GOOGLE_APPLICATION_CREDENTIALS"]
const prefix = "[pdf-converter]"

function findGo() {
  const candidates = [
    process.env.GOROOT ? resolve(process.env.GOROOT, "bin/go") : null,
    "/usr/local/go/bin/go",
    resolve(process.env.HOME ?? "", "go/bin/go"),
  ].filter((candidate) => candidate && existsSync(candidate))
  const onPath = spawnSync("go", ["version"], { stdio: "ignore" })
  if (onPath.status === 0) return "go"
  return candidates[0] ?? null
}

function loadApiEnv() {
  if (!existsSync(apiEnvFile)) return {}
  return parseEnv(readFileSync(apiEnvFile, "utf8"))
}

function buildEnv() {
  const apiEnv = loadApiEnv()
  const env = { ...process.env }
  for (const name of inheritedFromApi) {
    if (!env[name] && apiEnv[name]) env[name] = apiEnv[name]
  }
  env.PORT = process.env.PDF_CONVERTER_PORT ?? "3002"
  return env
}

const goBinary = findGo()
if (!goBinary) {
  console.warn(
    `${prefix} Go toolchain not found, skipping. Install Go (https://go.dev/dl/) to run it.`,
  )
  process.exit(0)
}

const env = buildEnv()
if (!env.GCS_STORAGE_BUCKET_NAME) {
  console.warn(
    `${prefix} GCS_STORAGE_BUCKET_NAME is not set (checked the environment and ${apiEnvFile}), skipping.`,
  )
  process.exit(0)
}

console.log(`${prefix} starting on http://localhost:${env.PORT} (MCP endpoint: /mcp)`)
const child = spawn(goBinary, ["run", "."], { cwd: serviceDir, env, stdio: "inherit" })

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal))
}
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
