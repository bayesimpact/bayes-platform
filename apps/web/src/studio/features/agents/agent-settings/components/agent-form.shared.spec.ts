import { describe, expect, it } from "vitest"
import { getCreationFields } from "./agent-form.shared"

describe("getCreationFields", () => {
  it("sends a conversation agent's type alone", () => {
    expect(getCreationFields("conversation")).toEqual({ type: "conversation" })
  })

  it("sends an extraction agent's type alone", () => {
    expect(getCreationFields("extraction")).toEqual({ type: "extraction" })
  })

  it("creates a form agent as a conversation agent with the fillForm tool", () => {
    expect(getCreationFields("form")).toEqual({ type: "conversation", fillFormEnabled: true })
  })
})
