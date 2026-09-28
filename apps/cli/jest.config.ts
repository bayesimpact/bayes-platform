import { resolve } from "node:path"
import type { Config } from "jest"

const apiContractsPath = resolve(__dirname, "../../packages/api-contracts/src")

const config: Config = {
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["js", "ts", "json"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleNameMapper: {
    "^@caseai-connect/api-contracts$": `${apiContractsPath}/index.ts`,
  },
}

export default config
