import { KNOWN_WORKER_QUEUE_NAMES } from "./worker-pools"
import { WORKER_MODULE_REGISTRY } from "./workers-app.module"

/**
 * `WORKER_QUEUE_NAMES=all` (smoke check, test setup) expands to
 * KNOWN_WORKER_QUEUE_NAMES. A queue registered in one list but not the other
 * would either never boot in CI or be rejected as unknown at startup (#732).
 */
describe("WORKER_MODULE_REGISTRY", () => {
  const registryQueues = WORKER_MODULE_REGISTRY.flatMap((entry) => entry.queues)

  it("covers exactly the known worker queues", () => {
    expect([...registryQueues].sort()).toEqual([...KNOWN_WORKER_QUEUE_NAMES].sort())
  })

  it("maps each queue to a single module", () => {
    expect(new Set(registryQueues).size).toBe(registryQueues.length)
  })
})
