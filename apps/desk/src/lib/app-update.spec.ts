import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/config", () => ({ appConfig: { buildId: undefined } }))

const { createAppUpdate } = await import("./app-update")

const A_MINUTE = 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("createAppUpdate", () => {
  it("counts another build as new once it alone was published for a minute, and says so once", () => {
    const update = createAppUpdate("1")
    const listener = vi.fn()
    update.subscribe(listener)

    update.reportPublishedBuild("1.1")
    vi.advanceTimersByTime(A_MINUTE - 1)
    update.reportPublishedBuild("1.1")
    expect(update.isAvailable()).toBe(false)

    vi.advanceTimersByTime(1)
    update.reportPublishedBuild("1.1")
    update.reportPublishedBuild("1.1")
    expect(update.isAvailable()).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
  })

  it("stays on its build while that build is still published, as during a rolling deployment", () => {
    // This tab loaded from a new server, while old ones still answer.
    const update = createAppUpdate("1.1")

    update.reportPublishedBuild("1")
    vi.advanceTimersByTime(A_MINUTE / 2)
    update.reportPublishedBuild("1.1")
    vi.advanceTimersByTime(A_MINUTE / 2)
    update.reportPublishedBuild("1")
    expect(update.isAvailable()).toBe(false)

    // The minute counts again from the last time this tab's build was published.
    vi.advanceTimersByTime(A_MINUTE)
    update.reportPublishedBuild("1")
    expect(update.isAvailable()).toBe(true)
  })

  it("keeps a new build once known, whatever is published next", () => {
    const update = createAppUpdate("1")
    update.reportPublishedBuild("1.1")
    vi.advanceTimersByTime(A_MINUTE)
    update.reportPublishedBuild("1.1")

    update.reportPublishedBuild("1")

    expect(update.isAvailable()).toBe(true)
  })

  it("counts no build as new where this tab has no id of its own", () => {
    const update = createAppUpdate(undefined)
    update.reportPublishedBuild("1.1")
    vi.advanceTimersByTime(A_MINUTE)
    update.reportPublishedBuild("1.1")
    expect(update.isAvailable()).toBe(false)
  })

  it("counts a file of this build gone from the server as a new build at once", () => {
    const update = createAppUpdate("1")
    update.reportStaleBuild()
    expect(update.isAvailable()).toBe(true)
  })
})
