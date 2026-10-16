// Runs the API's TypeScript sources directly with Node, in place of ts-node and
// tsconfig-paths: `node --import ./scripts/register.mjs src/scripts/seed-rbac.ts`.
//
// SWC compiles each .ts file in memory with the options of the build (.swcrc), so decorator
// metadata and the `@/` paths behave as in `dist/`. Nothing here loads the TypeScript compiler,
// which keeps the scripts and migrations working once `typescript` has no JavaScript API.

import { readFileSync } from "node:fs"
import { createRequire, registerHooks } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { transformSync } = require("@swc/core")
const { readSwcOptions } = require("./swc-options.cjs")

const swcOptions = readSwcOptions()

const isTypeScriptSource = (url) =>
  url.startsWith("file:") && url.endsWith(".ts") && !url.includes("/node_modules/")

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      // SWC keeps extensionless relative imports, which Node only resolves for .js files.
      const isRelative = specifier.startsWith(".") || specifier.startsWith("/")
      if (!isRelative || !context.parentURL || !isTypeScriptSource(context.parentURL)) throw error
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(candidate, context)
        } catch {
          // try the next candidate
        }
      }
      throw error
    }
  },
  load(url, context, nextLoad) {
    if (!isTypeScriptSource(url)) return nextLoad(url, context)
    const filename = fileURLToPath(url)
    const { code } = transformSync(readFileSync(filename, "utf8"), { ...swcOptions, filename })
    return { format: "commonjs", source: code, shortCircuit: true }
  },
})

process.setSourceMapsEnabled(true)
