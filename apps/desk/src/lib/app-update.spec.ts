import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/config", () => ({ appConfig: { appVersion: undefined, gitSha: undefined } }))

const { createAppUpdate } = await import("./app-update")

const A_MINUTE = 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("createAppUpdate", () => {
  it("counts another release as new once it alone answered for a minute, and says so once", () => {
    const update = createAppUpdate("1")
    const listener = vi.fn()
    update.subscribe(listener)

    update.reportServerVersion("1.1")
    vi.advanceTimersByTime(A_MINUTE - 1)
    update.reportServerVersion("1.1")
    expect(update.isAvailable()).toBe(false)

    vi.advanceTimersByTime(1)
    update.reportServerVersion("1.1")
    update.reportServerVersion("1.1")
    expect(update.isAvailable()).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
  })

  it("stays on its release while that release still answers, as during a rolling deployment", () => {
    // This tab loaded from a new server, while old ones still answer.
    const update = createAppUpdate("1.1")

    update.reportServerVersion("1")
    vi.advanceTimersByTime(A_MINUTE / 2)
    update.reportServerVersion("1.1")
    vi.advanceTimersByTime(A_MINUTE / 2)
    update.reportServerVersion("1")
    expect(update.isAvailable()).toBe(false)

    // The minute counts again from the last answer of this tab's release.
    vi.advanceTimersByTime(A_MINUTE)
    update.reportServerVersion("1")
    expect(update.isAvailable()).toBe(true)
  })

  it("keeps a new release once known, whatever answers next", () => {
    const update = createAppUpdate("1")
    update.reportServerVersion("1.1")
    vi.advanceTimersByTime(A_MINUTE)
    update.reportServerVersion("1.1")

    update.reportServerVersion("1")

    expect(update.isAvailable()).toBe(true)
  })

  it("counts no release as new where this tab knows no version of its own", () => {
    const update = createAppUpdate(undefined)
    update.reportServerVersion("1.1")
    vi.advanceTimersByTime(A_MINUTE)
    update.reportServerVersion("1.1")
    expect(update.isAvailable()).toBe(false)
  })

  it("counts a file of this release gone from the server as a new release at once", () => {
    const update = createAppUpdate("1")
    update.reportStaleBuild()
    expect(update.isAvailable()).toBe(true)
  })
})
