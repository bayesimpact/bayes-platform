import { describe, expect, it } from "vitest"
import { timeAgoOf } from "./time-ago"

const now = new Date(2026, 9, 21, 15, 1).getTime()
const minutes = (count: number) => now - count * 60 * 1000

describe("timeAgoOf", () => {
  it("counts seconds, minutes, hours and days back from now", () => {
    expect(timeAgoOf(now - 20_000, now, "en")).toBe("20 seconds ago")
    expect(timeAgoOf(minutes(5), now, "en")).toBe("5 minutes ago")
    expect(timeAgoOf(minutes(3 * 60), now, "en")).toBe("3 hours ago")
    expect(timeAgoOf(minutes(3 * 24 * 60), now, "en")).toBe("3 days ago")
  })

  it("speaks the person's language, and English for one it does not know", () => {
    expect(timeAgoOf(minutes(5), now, "fr")).toBe("il y a 5 minutes")
    expect(timeAgoOf(minutes(5), now, "de")).toBe("5 minutes ago")
  })

  it("reads a moment after now as now", () => {
    expect(timeAgoOf(now + 5000, now, "en")).toBe("0 seconds ago")
  })
})
