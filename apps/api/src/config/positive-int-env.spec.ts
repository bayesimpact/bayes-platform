import { readPositiveIntEnv } from "./positive-int-env"

describe("readPositiveIntEnv", () => {
  const key = "POSITIVE_INT_ENV_SPEC_VALUE"
  const originalValue = process.env[key]

  beforeEach(() => {
    delete process.env[key]
  })

  afterAll(() => {
    if (originalValue === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalValue
    }
  })

  it("parses a plain positive integer", () => {
    process.env[key] = "42"
    expect(readPositiveIntEnv(key)).toBe(42)
  })

  it("returns the default when unset", () => {
    expect(readPositiveIntEnv(key, { defaultValue: 7 })).toBe(7)
  })

  it("returns the default when empty", () => {
    process.env[key] = ""
    expect(readPositiveIntEnv(key, { defaultValue: 7 })).toBe(7)
  })

  it("throws when unset without a default", () => {
    expect(() => readPositiveIntEnv(key)).toThrow(
      /POSITIVE_INT_ENV_SPEC_VALUE must be set to a positive integer\./,
    )
  })

  it("throws when empty without a default", () => {
    process.env[key] = ""
    expect(() => readPositiveIntEnv(key, { unitWord: "seconds" })).toThrow(
      /POSITIVE_INT_ENV_SPEC_VALUE must be set to a positive integer \(seconds\)\./,
    )
  })

  it.each([
    ["zero", "0"],
    ["negative", "-5"],
    ["a trailing unit", "15m"],
    ["a decimal", "1.5"],
    ["a leading plus sign", "+15"],
    ["surrounding whitespace", " 15 "],
    ["text", "not-a-number"],
  ])("rejects %s even when a default is set", (_description, rawValue) => {
    process.env[key] = rawValue
    expect(() => readPositiveIntEnv(key, { defaultValue: 7 })).toThrow(
      /POSITIVE_INT_ENV_SPEC_VALUE must be a positive integer\./,
    )
  })

  it("mentions the unit word in the invalid-value error", () => {
    process.env[key] = "0"
    expect(() => readPositiveIntEnv(key, { unitWord: "seconds" })).toThrow(
      /POSITIVE_INT_ENV_SPEC_VALUE must be a positive integer \(seconds\)\./,
    )
  })
})
