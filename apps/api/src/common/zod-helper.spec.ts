import { castToolInputParameters } from "./zod-helper"

describe("castToolInputParameters", () => {
  it("coerces stringified scalars back to their primitive type", () => {
    expect(
      castToolInputParameters({ happy: "true", asleep: "false", hours: "7", note: "hello" }),
    ).toEqual({ happy: true, asleep: false, hours: 7, note: "hello" })
  })

  it("drops null, undefined, and the literal string 'null'", () => {
    expect(castToolInputParameters({ a: null, b: undefined, c: "null" })).toEqual({
      a: undefined,
      b: undefined,
      c: undefined,
    })
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
