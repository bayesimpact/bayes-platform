const { join } = require("node:path")
const nestConfig = require("./jest.config.ts").default
// Explicit `.ts` extension: WebStorm's "Recompile on changes" leaves a compiled
// `.js` next to the source, which a plain import would silently pick up.
const { getNbWorkers } = require("./src/scripts/dbs4tests-config.ts")

export default {
  ...nestConfig,

  moduleFileExtensions: ["ts", "js", "json"],
  transformIgnorePatterns: ["/node_modules/(?!langfuse-core/)", "\\.pnp\\.[^\\\\]+$"],
  maxWorkers: getNbWorkers(),
  cacheDirectory: join(__dirname, "../../node_modules/.cache/jest"),
}
