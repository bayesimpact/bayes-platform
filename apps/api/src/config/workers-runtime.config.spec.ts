import { getWorkerDoclingHealthCheckTimeoutMs, getWorkerHealthPort } from "./workers-runtime.config"

describe("workers runtime configuration", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS
    delete process.env.WORKER_HEALTH_PORT
    delete process.env.PORT
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("defaults the Docling health check to 30 s", () => {
    expect(getWorkerDoclingHealthCheckTimeoutMs()).toBe(30_000)
  })

  it("reads the Docling health check override", () => {
    process.env.WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS = "5000"
    expect(getWorkerDoclingHealthCheckTimeoutMs()).toBe(5000)
  })

  it("defaults the health port to 8080", () => {
    expect(getWorkerHealthPort()).toBe(8080)
  })

  it("falls back to PORT when WORKER_HEALTH_PORT is unset", () => {
    process.env.PORT = "3000"
    expect(getWorkerHealthPort()).toBe(3000)
  })

  it("prefers WORKER_HEALTH_PORT over PORT", () => {
    process.env.WORKER_HEALTH_PORT = "8081"
    process.env.PORT = "3000"
    expect(getWorkerHealthPort()).toBe(8081)
  })

  it("rejects a port that is not a plain positive integer", () => {
    process.env.WORKER_HEALTH_PORT = "8081abc"
    expect(() => getWorkerHealthPort()).toThrow(/WORKER_HEALTH_PORT must be a positive integer\./)
  })
})
