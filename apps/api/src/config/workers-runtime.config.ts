import { readPositiveIntEnv } from "./positive-int-env"

const DEFAULT_WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS = 30_000
const DEFAULT_WORKER_HEALTH_PORT = 8080

/** How long the Docling health check at boot may take before the workers give up. */
export function getWorkerDoclingHealthCheckTimeoutMs(): number {
  return readPositiveIntEnv("WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS", {
    defaultValue: DEFAULT_WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS,
    unitWord: "milliseconds",
  })
}

/**
 * Port of the workers health endpoint. WORKER_HEALTH_PORT wins over PORT, which
 * is what the platform sets for a process it believes serves HTTP.
 */
export function getWorkerHealthPort(): number {
  const variableName = process.env.WORKER_HEALTH_PORT ? "WORKER_HEALTH_PORT" : "PORT"
  return readPositiveIntEnv(variableName, { defaultValue: DEFAULT_WORKER_HEALTH_PORT })
}
