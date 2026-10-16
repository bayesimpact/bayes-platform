const { join } = require("node:path")
const nestConfig = require("./jest.config.js")
// Explicit `.ts` extension: WebStorm's "Recompile on changes" leaves a compiled
// `.js` next to the source, which a plain import would silently pick up.
// Jest must run with `--import ./scripts/register.mjs` to load it.
const { getNbWorkers } = require("./src/scripts/dbs4tests-config.ts")

module.exports = {
  ...nestConfig,

  moduleFileExtensions: ["ts", "js", "json"],
  transformIgnorePatterns: ["/node_modules/", "\\.pnp\\.[^\\\\]+$"],
  maxWorkers: getNbWorkers(),
  cacheDirectory: join(__dirname, "../../node_modules/.cache/jest"),
}
