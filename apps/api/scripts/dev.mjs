// Runs an API entry point in development, in place of `nest start --watch`:
// SWC compiles src/ into the output directory and recompiles on change, and Node restarts
// the entry point whenever a compiled file changes.
//
// Usage: node scripts/dev.mjs <entry> <outDir> [node options...]
//   node scripts/dev.mjs main dist
//   node scripts/dev.mjs workers-main dist-workers
//   node scripts/dev.mjs main dist --inspect
//
// The API and the workers use separate output directories so their watchers never
// rewrite each other's files.

import { spawn, spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const [entry, outDir, ...nodeOptions] = process.argv.slice(2)
if (!entry || !outDir) {
  console.error("Usage: node scripts/dev.mjs <entry> <outDir> [node options...]")
  process.exit(2)
}

const swcCli = createRequire(import.meta.url).resolve("@swc/cli/bin/swc.js")
const swcArguments = [swcCli, "src", "-d", outDir, "--strip-leading-paths"]

const initialBuild = spawnSync(process.execPath, [...swcArguments, "--delete-dir-on-start"], {
  cwd: apiRoot,
  stdio: "inherit",
})
if (initialBuild.status !== 0) process.exit(initialBuild.status ?? 1)

const children = [
  spawn(process.execPath, [...swcArguments, "--watch", "--quiet"], {
    cwd: apiRoot,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    ["--watch", "--enable-source-maps", ...nodeOptions, join(outDir, `${entry}.js`)],
    { cwd: apiRoot, stdio: "inherit" },
  ),
]

let exiting = false
const stopAll = (exitCode) => {
  if (exiting) return
  exiting = true
  for (const child of children) child.kill("SIGTERM")
  process.exitCode = exitCode
}

for (const child of children) child.on("exit", (code) => stopAll(code ?? 1))
process.on("SIGINT", () => stopAll(0))
process.on("SIGTERM", () => stopAll(0))
