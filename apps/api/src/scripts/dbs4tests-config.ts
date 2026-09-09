import { availableParallelism, cpus } from "node:os"
import { resolve } from "node:path"
import { config as dotenvConfig } from "dotenv"

dotenvConfig({ path: resolve(__dirname, "../../.env.test"), override: true, quiet: true })

export function getNbWorkers(): number {
  const envWorkers = Number(process.env.TEST_WORKERS)
  if (Number.isFinite(envWorkers) && envWorkers > 0) {
    console.log(`>>env.TEST_WORKERS=${process.env.TEST_WORKERS}`)
    return Math.floor(envWorkers)
  }
  const nbWorkers = Math.max(1, Math.floor(getCpuCount() * 0.5))
  console.log(`>>default-WORKERS=${nbWorkers}`)
  process.env.TEST_WORKERS = String(nbWorkers)
  return nbWorkers
}
function getCpuCount(): number {
  return typeof availableParallelism === "function" ? availableParallelism() : cpus().length
}
