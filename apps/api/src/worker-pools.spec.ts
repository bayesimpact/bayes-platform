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
