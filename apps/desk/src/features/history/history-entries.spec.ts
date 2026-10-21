import { describe, expect, it } from "vitest"
import { extractionEntries, groupByPeriod, type HistoryEntry } from "./history-entries"

const now = new Date(2026, 9, 21, 15, 0).getTime()

const conversationAt = (title: string, date: Date): HistoryEntry => ({
  kind: "conversation",
  id: crypto.randomUUID(),
  title,
  createdAt: date.getTime(),
})

describe("groupByPeriod", () => {
  it("groups by calendar day in the person's time zone, without the empty periods", () => {
    const entries = [
      conversationAt("This morning", new Date(2026, 9, 21, 0, 30)),
      conversationAt("Last night", new Date(2026, 9, 20, 23, 30)),
      conversationAt("Last week", new Date(2026, 9, 14, 12, 0)),
      conversationAt("Last year", new Date(2025, 9, 21, 12, 0)),
    ]

    expect(
      groupByPeriod(entries, now).map((group) => [
        group.period,
        group.entries.map((entry) => (entry.kind === "conversation" ? entry.title : null)),
      ]),
    ).toEqual([
      ["today", ["This morning"]],
      ["yesterday", ["Last night"]],
      ["previous7Days", ["Last week"]],
      ["older", ["Last year"]],
    ])
  })
})

describe("extractionEntries", () => {
  it("mixes documents and CSV files newest first, and reads their state", () => {
    const entries = extractionEntries(
      [
        {
          id: crypto.randomUUID(),
          documentFileName: "summary.pdf",
          status: "success",
          createdAt: 3,
        },
        { id: crypto.randomUUID(), documentFileName: null, status: "failed", createdAt: 1 },
      ],
      [
        { id: crypto.randomUUID(), status: "running", createdAt: 2 },
        { id: crypto.randomUUID(), status: "cancelled", createdAt: 0 },
      ],
    )

    expect(
      entries.map((entry) => [entry.kind, entry.kind === "conversation" ? null : entry.state]),
    ).toEqual([
      ["extraction", "done"],
      ["csv", "pending"],
      ["extraction", "failed"],
      ["csv", "done"],
    ])
  })
})
