const { resolve } = require("node:path")
const { readSwcOptions } = require("./scripts/swc-options.cjs")

// Resolve path to api-contracts package
const apiContractsPath = resolve(__dirname, "../../packages/api-contracts/src")
// Resolve path to desk-contracts package
const deskContractsPath = resolve(__dirname, "../../packages/desk-contracts/src")
// Resolve path to eval-contracts package
const evalContractsPath = resolve(__dirname, "../../packages/eval-contracts/src")
// Resolve path to the permissions package, which every contracts package imports
const permissionsPath = resolve(__dirname, "../../packages/permissions/src")

const nestConfig = {
  collectCoverage: false,
  coverageProvider: "v8",
  moduleFileExtensions: ["js", "ts", "json"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  // Live-regression suites call real LLM endpoints (vLLM, Vertex). They must
  // NEVER run in CI: without LIVE_PROVIDER_REGRESSIONS=1 they are not even
  // collected (importing them requires network creds and node flags).
  testPathIgnorePatterns:
    process.env.LIVE_PROVIDER_REGRESSIONS === "1" ? [] : [".*\\.live\\.spec\\.ts$"],
  transform: {
    // Same SWC options as the build (.swcrc): decorator metadata, the @/ paths.
    "^.+\\.(t|j)s$": ["@swc/jest", readSwcOptions()],
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/migrations/**",
    "!**/*.migration.ts",
    "!**/dto/**",
    "!**/*.dto.ts",
    "!**/*.types.ts",
    "!**/*.interface.ts",
    "!**/*.factory.ts",
    "!**/*.entity.ts",
    "!**/*.module.ts",
    "!**/script/**",
    "!**/llm/ai-sdk/providers/*.provider.ts",
    // Live-provider regression harness: fixtures, scenarios and the manual
    // measurement script. Their specs are excluded from CI (no LLM calls), so
    // these sources can never be executed there — counting them as uncovered
    // hides the real coverage of product code.
    "!**/live-regressions/**",
  ],
  coverageDirectory: "../coverage",
  coverageReporters: ["json-summary", "text", "lcov"],
  testEnvironment: "node",
  testTimeout: 15_000,
  setupFiles: ["<rootDir>/../jest.setup-early.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@bayes-platform/api-contracts$": `${apiContractsPath}/index.ts`,
    "^@bayes-platform/api-contracts/(.*)$": `${apiContractsPath}/$1`,
    "^@bayes-platform/desk-contracts$": `${deskContractsPath}/index.ts`,
    "^@bayes-platform/desk-contracts/(.*)$": `${deskContractsPath}/$1`,
    "^@bayes-platform/eval-contracts$": `${evalContractsPath}/index.ts`,
    "^@bayes-platform/eval-contracts/(.*)$": `${evalContractsPath}/$1`,
    "^@bayes-platform/permissions$": `${permissionsPath}/index.ts`,
  },
  setupFilesAfterEnv: ["<rootDir>/../jest.setup.ts"],
}
module.exports = nestConfig
