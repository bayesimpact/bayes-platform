import { type ChildProcess, spawn } from "node:child_process"
// Aliased: `resolve` would shadow the promise resolver in `runCommand`.
import { resolve as resolvePath } from "node:path"
import { config as dotenvConfig } from "dotenv"
import { getNbWorkers } from "./dbs4tests-config"
import { workerDatabasesExist } from "./dbs4tests-exists"

dotenvConfig({ path: resolvePath(__dirname, "../../.env.test"), override: true, quiet: true })

type RunCommandResult = {
  exitCode: number
  signal: NodeJS.Signals | null
}

let activeChildProcess: ChildProcess | null = null
let receivedTerminationSignal = false

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    })
    activeChildProcess = childProcess

    childProcess.on("error", (error) => {
      reject(error)
    })

    childProcess.on("close", (exitCode, signal) => {
      if (activeChildProcess === childProcess) {
        activeChildProcess = null
      }
      resolve({
        exitCode: exitCode ?? 1,
        signal,
      })
    })
  })
}

function forwardSignalToActiveChild(signal: NodeJS.Signals): void {
  receivedTerminationSignal = true
  if (activeChildProcess?.pid) {
    activeChildProcess.kill(signal)
  }
}

async function main(): Promise<void> {
  process.env.TEST_USE_WORKER_DATABASE = "true"
  process.env.MCP_ENCRYPTION_KEY ??=
    "0000000000000000000000000000000000000000000000000000000000000000"
  const nbWorkers = getNbWorkers()

  process.on("SIGINT", () => forwardSignalToActiveChild("SIGINT"))
  process.on("SIGTERM", () => forwardSignalToActiveChild("SIGTERM"))

  const scriptEnvironment = { ...process.env }
  const jestAdditionalArguments = process.argv.slice(2)
  let prepareExitCode = 0
  let jestExitCode = 0

  const canReuseWorkerDatabases =
    process.env.TEST_FORCE_RECREATE_WORKER_DB !== "true" && (await workerDatabasesExist(nbWorkers))

  if (canReuseWorkerDatabases) {
    console.log(`Reusing ${nbWorkers} existing worker databases.`)
  } else {
    const prepareResult = await runCommand(
      "npm",
      ["run", "dbs4tests:prepare", "--", `--workers=${nbWorkers}`],
      scriptEnvironment,
    )
    prepareExitCode = prepareResult.exitCode
  }

  if (prepareExitCode === 0) {
    const jestResult = await runCommand(
      process.execPath,
      [
        "../../node_modules/jest/bin/jest.js",
        "--colors",
        "--forceExit",
        "--config",
        "jest.win.config.ts",
        ...jestAdditionalArguments,
      ],
      scriptEnvironment,
    )
    jestExitCode = jestResult.exitCode
  }

  if (receivedTerminationSignal && jestExitCode === 0) {
    process.exit(130)
  }

  if (prepareExitCode !== 0) {
    process.exit(prepareExitCode)
  }

  process.exit(jestExitCode)
}

main().catch((error) => {
  console.error("Failed to run parallel tests:", error)
  process.exit(1)
})
