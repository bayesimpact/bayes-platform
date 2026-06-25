import { resolve } from "node:path"

// Resolve path to api-contracts package
const apiContractsPath = resolve(__dirname, "../../packages/api-contracts/src")

export const nestConfig = {
  collectCoverage: false,
  coverageProvider: "v8",
  moduleFileExtensions: ["js", "ts", "json"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/migrations/**",
    "!**/*.migration.ts",
    "!**/dto/**",
    "!**/*.dto.ts",
  ],
  coverageDirectory: "../coverage",
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
