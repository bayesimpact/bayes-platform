import type { LoggerService } from "@nestjs/common"
import { Logger } from "@nestjs/common"

const DEFAULT_SIGNALS: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT"]

/** Anything that can register a one-shot signal listener; `process` in production. */
type SignalTarget = {
  once: (signal: NodeJS.Signals, listener: () => void) => unknown
}

export type GracefulShutdownOptions = {
  /** Stops the process for good: `app.close()` closes the server and runs the shutdown hooks. */
  close: () => Promise<void>
  /** Hard deadline: past it the process exits, whatever is still in flight. */
  timeoutMs: number
  /** Logger context, e.g. "Bootstrap" or "WorkersMain". */
  context: string
  /** What the wait is for, e.g. "the requests in flight" or "the jobs in progress". */
  workLabel: string
  /** Appended to the timeout warning, e.g. "; they go back to the queue". */
  timeoutHint?: string
  /**
   * Runs when the timeout is reached, before the exit: settles what the exit leaves half-done.
   * Keep it short, the platform kills the process soon after the timeout.
   */
  onTimeout?: () => Promise<void>
  /** Signals that start the shutdown. Defaults to SIGTERM and SIGINT. */
  signals?: readonly NodeJS.Signals[]
  logger?: LoggerService
  exit?: (code: number) => void
  signalTarget?: SignalTarget
}

/**
 * On SIGTERM (a rollout, a scale down), stop taking new work and let the work
 * in flight finish. The wait is bounded: past `timeoutMs` the process exits
 * anyway, because a stream or a long job would otherwise hold it open past the
 * termination grace period, and the container would be killed mid-write.
 *
 * Returns the shutdown handler, so a caller (a test) can run it without a real
 * signal.
 */
export function registerGracefulShutdown({
  close,
  timeoutMs,
  context,
  workLabel,
  timeoutHint = "",
  onTimeout,
  signals = DEFAULT_SIGNALS,
  logger = new Logger(context),
  exit = (code: number) => process.exit(code),
  signalTarget = process,
}: GracefulShutdownOptions): (signal: NodeJS.Signals) => Promise<void> {
  let shuttingDown = false

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    logger.log(`${signal} received: closing, waiting up to ${timeoutMs} ms for ${workLabel}`)

    const deadline = setTimeout(() => {
      logger.warn(`Still waiting for ${workLabel} after ${timeoutMs} ms, exiting${timeoutHint}`)
      if (!onTimeout) return exit(0)
      onTimeout()
        .catch((error: unknown) => {
          logger.error(
            "Error while settling the work left in flight",
            error instanceof Error ? error.stack : String(error),
          )
        })
        .finally(() => exit(0))
    }, timeoutMs)
    // Never keep the process alive just for the deadline.
    deadline.unref()

    try {
      await close()
      logger.log("Closed, exiting")
      exit(0)
    } catch (error) {
      logger.error("Error while closing", error instanceof Error ? error.stack : String(error))
      exit(1)
    } finally {
      clearTimeout(deadline)
    }
  }

  for (const signal of signals) {
    signalTarget.once(signal, () => void shutdown(signal))
  }

  return shutdown
}
