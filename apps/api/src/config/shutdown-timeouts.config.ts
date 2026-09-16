import { readPositiveIntEnv } from "./positive-int-env"

// Below the termination grace of the Helm chart (30 s). Cloud Run gives 10 s:
// set API_SHUTDOWN_TIMEOUT_MS lower there.
const DEFAULT_API_SHUTDOWN_TIMEOUT_MS = 25_000
// Below the 120 s the Helm chart gives a workers pod to terminate. Cloud Run
// gives 10 s: set WORKER_SHUTDOWN_TIMEOUT_MS lower there.
const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 100_000

/** How long the API waits for the requests in flight before it exits. */
export function getApiShutdownTimeoutMs(): number {
  return readPositiveIntEnv("API_SHUTDOWN_TIMEOUT_MS", {
    defaultValue: DEFAULT_API_SHUTDOWN_TIMEOUT_MS,
    unitWord: "milliseconds",
  })
}

/** How long a workers process waits for the jobs in progress before it exits. */
export function getWorkerShutdownTimeoutMs(): number {
  return readPositiveIntEnv("WORKER_SHUTDOWN_TIMEOUT_MS", {
    defaultValue: DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS,
    unitWord: "milliseconds",
  })
}
