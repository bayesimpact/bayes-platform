import type { LoggerService } from "@nestjs/common"
import { registerGracefulShutdown } from "./graceful-shutdown"

describe("registerGracefulShutdown", () => {
  const buildLogger = (): jest.Mocked<LoggerService> => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  })

  const buildSignalTarget = () => ({ once: jest.fn() })

  const register = (overrides: Partial<Parameters<typeof registerGracefulShutdown>[0]> = {}) => {
    const logger = buildLogger()
    const signalTarget = buildSignalTarget()
    const exit = jest.fn()
    const shutdown = registerGracefulShutdown({
      close: jest.fn().mockResolvedValue(undefined),
      timeoutMs: 25_000,
      context: "SpecContext",
      workLabel: "the requests in flight",
      logger,
      exit,
      signalTarget,
      ...overrides,
    })
    return { shutdown, logger, exit, signalTarget }
  }

  it("listens once to SIGTERM and SIGINT", () => {
    const { signalTarget } = register()

    expect(signalTarget.once).toHaveBeenCalledTimes(2)
    expect(signalTarget.once).toHaveBeenCalledWith("SIGTERM", expect.any(Function))
    expect(signalTarget.once).toHaveBeenCalledWith("SIGINT", expect.any(Function))
  })

  it("runs the shutdown when a registered signal fires", async () => {
    const close = jest.fn().mockResolvedValue(undefined)
    const { signalTarget, exit } = register({ close })

    const [, sigtermListener] = signalTarget.once.mock.calls[0]
    sigtermListener()
    await Promise.resolve()

    expect(close).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it("closes, then exits 0", async () => {
    const close = jest.fn().mockResolvedValue(undefined)
    const { shutdown, logger, exit } = register({ close })

    await shutdown("SIGTERM")

    expect(logger.log).toHaveBeenCalledWith(
      "SIGTERM received: closing, waiting up to 25000 ms for the requests in flight",
    )
    expect(close).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it("exits 1 and logs the stack when closing fails", async () => {
    const failure = new Error("close failed")
    const { shutdown, logger, exit } = register({ close: jest.fn().mockRejectedValue(failure) })

    await shutdown("SIGTERM")

    expect(logger.error).toHaveBeenCalledWith("Error while closing", failure.stack)
    expect(exit).toHaveBeenCalledWith(1)
  })

  it("ignores every signal after the first one", async () => {
    const close = jest.fn().mockResolvedValue(undefined)
    const { shutdown } = register({ close })

    await shutdown("SIGTERM")
    await shutdown("SIGINT")

    expect(close).toHaveBeenCalledTimes(1)
  })

  describe("with a close that never settles", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("exits 0 once the timeout is reached", async () => {
      const { shutdown, logger, exit } = register({
        close: jest.fn().mockReturnValue(new Promise<void>(() => {})),
        timeoutHint: "; they go back to the queue",
        workLabel: "the jobs in progress",
      })

      void shutdown("SIGTERM")
      await jest.advanceTimersByTimeAsync(25_000)

      expect(logger.warn).toHaveBeenCalledWith(
        "Still waiting for the jobs in progress after 25000 ms, exiting; they go back to the queue",
      )
      expect(exit).toHaveBeenCalledWith(0)
    })

    it("does not warn when the close finishes before the timeout", async () => {
      const { shutdown, logger, exit } = register()

      await shutdown("SIGTERM")
      await jest.advanceTimersByTimeAsync(60_000)

      expect(logger.warn).not.toHaveBeenCalled()
      expect(exit).toHaveBeenCalledTimes(1)
    })
  })
})
