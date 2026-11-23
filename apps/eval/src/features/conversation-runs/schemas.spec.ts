import { describe, expect, it } from "vitest"
import { conversationRunFormSchema } from "./schemas"

const values = {
  versionId: crypto.randomUUID(),
  judgeModel: "judge-model",
  judgeInstructions: "",
  scope: "all" as const,
  limitedCount: 1,
}

describe("conversationRunFormSchema", () => {
  it("accepts all the records while the count is empty", () => {
    expect(
      conversationRunFormSchema.safeParse({ ...values, limitedCount: Number.NaN }).success,
    ).toBe(true)
  })

  it("refuses the first records with an empty count, on the count's field", () => {
    const result = conversationRunFormSchema.safeParse({
      ...values,
      scope: "limited",
      limitedCount: Number.NaN,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["limitedCount"]])
  })

  it("accepts a whole number of first records, and refuses a fraction or zero", () => {
    const parse = (limitedCount: number) =>
      conversationRunFormSchema.safeParse({ ...values, scope: "limited", limitedCount }).success
    expect(parse(3)).toBe(true)
    expect(parse(2.5)).toBe(false)
    expect(parse(0)).toBe(false)
  })
})
