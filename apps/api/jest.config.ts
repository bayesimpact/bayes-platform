import { resolve } from "node:path"

// Resolve path to api-contracts package
const apiContractsPath = resolve(__dirname, "../../packages/api-contracts/src")

export const nestConfig = {
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
    "^.+\\.(t|j)s$": "ts-jest",
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
    "^@caseai-connect/api-contracts$": `${apiContractsPath}/index.ts`,
    "^@caseai-connect/api-contracts/(.*)$": `${apiContractsPath}/$1`,
  },
  setupFilesAfterEnv: ["<rootDir>/../jest.setup.ts"],
}
export default nestConfig
