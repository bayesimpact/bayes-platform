import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { config as dotenvConfig } from "dotenv"
import { getNbWorkers } from "./dbs4tests-config"
import { parseWorkersArgument, workerDatabasesExist } from "./dbs4tests-exists"

dotenvConfig({ path: resolve(__dirname, "../../.env.test"), override: true, quiet: true })

function runPrepare(workerCount: number): Promise<number> {
  return new Promise((resolveExitCode, reject) => {
    const childProcess = spawn(
      "npm",
      ["run", "dbs4tests:prepare", "--", `--workers=${workerCount}`],
      { stdio: "inherit", env: process.env, shell: process.platform === "win32" },
    )
    childProcess.on("error", reject)
    childProcess.on("close", (exitCode) => resolveExitCode(exitCode ?? 1))
  })
}

async function main(): Promise<void> {
  const workerCount = parseWorkersArgument() ?? getNbWorkers()

  if (
    process.env.TEST_FORCE_RECREATE_WORKER_DB !== "true" &&
    (await workerDatabasesExist(workerCount))
  ) {
    console.log(`${workerCount} worker databases already present, skipping prepare.`)
    return
  }

  process.exit(await runPrepare(workerCount))
}

main().catch((error) => {
  console.error("Failed to ensure test worker databases:", error)
  process.exit(1)
})
