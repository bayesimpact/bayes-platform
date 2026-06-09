const DEFAULT_WORKER_HEALTH_PORT = 8080

/**
 * Resolves the port the worker health HTTP server (/healthz) listens on.
 * Shared by both worker entrypoints (gpu-workers-main.ts and cpu-workers-main.ts).
 */
export function getWorkerHealthPort(): number {
  const portValue = process.env.WORKER_HEALTH_PORT ?? process.env.PORT
  if (!portValue) {
    return DEFAULT_WORKER_HEALTH_PORT
  }

  const parsedPort = Number.parseInt(portValue, 10)
  return Number.isNaN(parsedPort) ? DEFAULT_WORKER_HEALTH_PORT : parsedPort
}
