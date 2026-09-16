import { castToolInputParameters } from "./zod-helper"

describe("castToolInputParameters", () => {
  it("coerces stringified scalars back to their primitive type", () => {
    expect(
      castToolInputParameters({ happy: "true", asleep: "false", hours: "7", note: "hello" }),
    ).toEqual({ happy: true, asleep: false, hours: 7, note: "hello" })
  })

  it("drops null, undefined, and the literal string 'null', key included", () => {
    // The key itself must go: the result is merged into the stored form, and
    // an undefined key would erase a value collected on an earlier turn.
    expect(castToolInputParameters({ a: null, b: undefined, c: "null", d: "kept" })).toEqual({
      d: "kept",
    })
    expect(Object.keys(castToolInputParameters({ a: "null" }))).toEqual([])
  })

  it("preserves arrays and objects instead of flattening them away", () => {
    expect(
      castToolInputParameters({
        tags: ["a", "b"],
        scores: [1, 2, 3],
        metadata: { source: "import" },
      }),
    ).toEqual({
      tags: ["a", "b"],
      scores: [1, 2, 3],
      metadata: { source: "import" },
    })
  })
})
