import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SIGN_IN_REFUSALS, signInRefusalOf } from "./sign-in-refusals"

/**
 * The API's own texts, read from api-contracts as a file: this package imports no other workspace
 * package, so a test of its copy reads the source instead.
 */
function readApiSignInErrors(): string[] {
  const source = readFileSync(
    new URL("../../api-contracts/src/me/sign-in-errors.ts", import.meta.url),
    "utf8",
  )
  const declaration = source.match(/export const SIGN_IN_ERRORS = \{([\s\S]*?)\} as const/)
  if (!declaration?.[1]) throw new Error("SIGN_IN_ERRORS not found in api-contracts")
  return [...declaration[1].matchAll(/:\s*"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1] ?? "")
}

describe("SIGN_IN_REFUSALS", () => {
  it("holds exactly the texts the API sends", () => {
    expect(Object.keys(SIGN_IN_REFUSALS).sort()).toEqual(readApiSignInErrors().sort())
  })
})

describe("signInRefusalOf", () => {
  it("names each refusal the API sends", () => {
    for (const [message, refusal] of Object.entries(SIGN_IN_REFUSALS)) {
      expect(signInRefusalOf(message)).toBe(refusal)
    }
  })

  it("names none for another message, a key every object inherits, or no text", () => {
    expect(signInRefusalOf("Unauthorized")).toBeNull()
    expect(signInRefusalOf("constructor")).toBeNull()
    expect(signInRefusalOf(undefined)).toBeNull()
  })
})
