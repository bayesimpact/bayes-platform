import { todaysDatePromptLine } from "./todays-date-prompt-line"

describe("todaysDatePromptLine", () => {
  it("states the date in YYYY-MM-DD and spells the format out", () => {
    expect(todaysDatePromptLine(new Date(2026, 8, 2))).toBe(
      "Today's date: 2026-09-02 (Date format YYYY-MM-DD)",
    )
  })

  it("zero-pads single-digit months and days", () => {
    expect(todaysDatePromptLine(new Date(2026, 0, 5))).toContain("2026-01-05")
  })

  it("reports the local calendar day, not the UTC one", () => {
    // 23:30 local on the 2nd is already the 3rd in UTC east of Greenwich;
    // the prompt must state the day the user is living in.
    expect(todaysDatePromptLine(new Date(2026, 8, 2, 23, 30))).toContain("2026-09-02")
  })

  it("defaults to today", () => {
    expect(todaysDatePromptLine()).toBe(todaysDatePromptLine(new Date()))
  })
})
