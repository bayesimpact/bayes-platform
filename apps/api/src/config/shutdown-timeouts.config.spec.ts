import { getApiShutdownTimeoutMs, getWorkerShutdownTimeoutMs } from "./shutdown-timeouts.config"

describe("shutdown timeouts", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.API_SHUTDOWN_TIMEOUT_MS
    delete process.env.WORKER_SHUTDOWN_TIMEOUT_MS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("defaults the API to 25 s", () => {
    expect(getApiShutdownTimeoutMs()).toBe(25_000)
  })

  it("defaults the workers to 100 s", () => {
    expect(getWorkerShutdownTimeoutMs()).toBe(100_000)
  })

  it("reads the API override", () => {
    process.env.API_SHUTDOWN_TIMEOUT_MS = "9000"
    expect(getApiShutdownTimeoutMs()).toBe(9000)
  })

  it("reads the workers override", () => {
    process.env.WORKER_SHUTDOWN_TIMEOUT_MS = "9000"
    expect(getWorkerShutdownTimeoutMs()).toBe(9000)
  })

  it("rejects a value that is not a plain positive integer", () => {
    process.env.API_SHUTDOWN_TIMEOUT_MS = "25s"
    expect(() => getApiShutdownTimeoutMs()).toThrow(
      /API_SHUTDOWN_TIMEOUT_MS must be a positive integer \(milliseconds\)\./,
    )
  })
})
