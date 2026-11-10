import { readIntEnv } from "@/common/utils/read-int-env"

describe("readIntEnv", () => {
  const testKey = "KEY_FOR_TEST_USE"
  afterEach(() => {
    delete process.env[testKey]
  })

  it("reads an integer", () => {
    process.env[testKey] = "3"
    expect(readIntEnv(testKey, 0)).toBe(3)
  })

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["not a number", "three"],
  ])("falls back to the default when the variable is %s", (_case, value) => {
    if (value !== undefined) process.env[testKey] = value
    expect(readIntEnv(testKey, 2)).toBe(2)
  })
})
