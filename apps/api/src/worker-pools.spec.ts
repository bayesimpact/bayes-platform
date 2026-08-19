import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  KNOWN_WORKER_QUEUE_NAMES,
  parseEnabledWorkerQueueNames,
  WORKER_QUEUE_NAMES_ENV,
} from "./worker-pools"

describe("parseEnabledWorkerQueueNames", () => {
  const originalValue = process.env[WORKER_QUEUE_NAMES_ENV]

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[WORKER_QUEUE_NAMES_ENV]
    } else {
      process.env[WORKER_QUEUE_NAMES_ENV] = originalValue
    }
  })

  it("throws when the env var is unset", () => {
    delete process.env[WORKER_QUEUE_NAMES_ENV]
    expect(() => parseEnabledWorkerQueueNames()).toThrow(WORKER_QUEUE_NAMES_ENV)
  })

  it("throws when the env var is empty or only separators", () => {
    process.env[WORKER_QUEUE_NAMES_ENV] = " , , "
    expect(() => parseEnabledWorkerQueueNames()).toThrow(WORKER_QUEUE_NAMES_ENV)
  })

  it("throws and names the offending queue when an unknown queue is listed", () => {
    process.env[WORKER_QUEUE_NAMES_ENV] = `${KNOWN_WORKER_QUEUE_NAMES[0]},not-a-real-queue`
    expect(() => parseEnabledWorkerQueueNames()).toThrow("not-a-real-queue")
  })

  it("trims whitespace and drops empty entries from a valid list", () => {
    const [first, second] = KNOWN_WORKER_QUEUE_NAMES
    process.env[WORKER_QUEUE_NAMES_ENV] = `  ${first} , ${second} ,`
    expect(parseEnabledWorkerQueueNames()).toEqual([first, second])
  })

  it("returns every known queue when all are listed", () => {
    process.env[WORKER_QUEUE_NAMES_ENV] = KNOWN_WORKER_QUEUE_NAMES.join(",")
    expect(parseEnabledWorkerQueueNames()).toEqual([...KNOWN_WORKER_QUEUE_NAMES])
  })
})

/**
 * These deploy/dev-config templates are never read by the running app, so a missing
 * queue there can't be caught by a boot-time check — this test is the equivalent
 * regression guard: every queue the app knows about must be provisioned somewhere.
 */
describe("KNOWN_WORKER_QUEUE_NAMES coverage across worker-pool templates", () => {
  function extractQueueNames(fileContents: string, pattern: RegExp): string[] {
    return [...fileContents.matchAll(pattern)].flatMap((match) =>
      (match[1] ?? "").split(",").map((queueName) => queueName.trim()),
    )
  }

  it("has every known queue listed in at least one template", () => {
    const envExample = readFileSync(join(__dirname, "../.env-example"), "utf-8")
    const jestSetupEarly = readFileSync(join(__dirname, "../jest.setup-early.ts"), "utf-8")
    const smokeCompose = readFileSync(
      join(__dirname, "../../../infra/docker-compose.api-workers-smoke.yaml"),
      "utf-8",
    )

    const declaredQueueNames = new Set([
      ...extractQueueNames(envExample, /^WORKER_QUEUE_NAMES=(.+)$/gm),
      ...extractQueueNames(jestSetupEarly, /WORKER_QUEUE_NAMES\s*\?\?=\s*"([^"]+)"/g),
      ...extractQueueNames(smokeCompose, /WORKER_QUEUE_NAMES:\s*"([^"]+)"/g),
    ])

    const missingQueueNames = KNOWN_WORKER_QUEUE_NAMES.filter(
      (queueName) => !declaredQueueNames.has(queueName),
    )
    expect(missingQueueNames).toEqual([])
  })
})
