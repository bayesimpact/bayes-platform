// SWC options for code compiled in memory (Jest, `node --import ./scripts/register.mjs`),
// read from the .swcrc that `swc src -d dist` uses for the build, so both compile alike.
// The build excludes tests through `exclude`, which in-memory compilation must not inherit.

const { readFileSync } = require("node:fs")
const { join } = require("node:path")

const apiRoot = join(__dirname, "..")

function readSwcOptions() {
  const {
    exclude: _buildOnly,
    $schema: _schema,
    ...options
  } = JSON.parse(readFileSync(join(apiRoot, ".swcrc"), "utf8"))
  return {
    ...options,
    swcrc: false,
    sourceMaps: "inline",
    // SWC needs an absolute baseUrl when the options do not come from a .swcrc file.
    jsc: { ...options.jsc, baseUrl: apiRoot },
  }
}

module.exports = { apiRoot, readSwcOptions }
