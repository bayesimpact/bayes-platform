import { describe, expect, it } from "vitest"
import { durationOf, fullDateTimeOf, relativeTimeOf } from "./relative-time"

const now = new Date(2026, 9, 21, 15, 1).getTime()
const minutes = (count: number) => now - count * 60 * 1000

describe("relativeTimeOf", () => {
  it("leaves the last minute to the caller, then counts minutes, hours and days", () => {
    expect(relativeTimeOf(now - 20_000, now, "en")).toBeNull()
    expect(relativeTimeOf(minutes(5), now, "en")).toBe("5 minutes ago")
    expect(relativeTimeOf(minutes(3 * 60), now, "en")).toBe("3 hours ago")
    expect(relativeTimeOf(minutes(24 * 60), now, "en")).toBe("yesterday")
    expect(relativeTimeOf(minutes(5), now, "fr")).toBe("il y a 5 minutes")
  })
})

describe("fullDateTimeOf", () => {
  it("writes the date and the time", () => {
    expect(fullDateTimeOf(now, "en").replace(/\s/g, " ")).toBe("Oct 21, 2026, 3:01 PM")
  })
})

describe("durationOf", () => {
  it("writes a duration with its two largest units", () => {
    expect(durationOf(14_200, "en")).toBe("14 sec")
    expect(durationOf(125_000, "en")).toBe("2 min 5 sec")
    expect(durationOf(3_780_000, "en")).toBe("1 hr 3 min")
    expect(durationOf(120_000, "en")).toBe("2 min")
    expect(durationOf(200, "en")).toBe("0 sec")
  })
})
