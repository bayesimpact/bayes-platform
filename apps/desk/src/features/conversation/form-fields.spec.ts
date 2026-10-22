import { setupI18n } from "@lingui/core"
import { describe, expect, it } from "vitest"
import { formFieldsOf } from "./form-fields"

const form = (
  state: Record<string, unknown>,
  outputJsonSchema?: {
    properties: Record<string, { type?: string }>
    propertyOrdering?: string[]
  },
) => ({
  agentId: crypto.randomUUID(),
  status: "in_progress" as const,
  state,
  outputJsonSchema,
  updatedAt: 0,
})

describe("formFieldsOf", () => {
  it("lists the schema's fields in its order, then the values it does not list", () => {
    const fields = formFieldsOf(
      form(
        { teamSize: 5, plan: "Pro", extraNote: "Call back" },
        {
          properties: { plan: { type: "string" }, teamSize: { type: "number" }, startDate: {} },
          propertyOrdering: ["teamSize", "plan", "startDate"],
        },
      ),
      setupI18n({ locale: "en", messages: { en: {} } }),
    )

    expect(fields.map((field) => [field.label, field.value])).toEqual([
      ["Team size", "5"],
      ["Plan", "Pro"],
      ["Start date", null],
      ["Extra note", "Call back"],
    ])
  })

  it("writes lists and numbers as text in the person's language", () => {
    const fields = formFieldsOf(
      form({ topics: ["Billing", "Support"], seats: 1200 }),
      setupI18n({ locale: "fr", messages: { fr: {} } }),
    )

    // French groups thousands with a narrow no-break space.
    expect(fields.map((field) => field.value?.replace(/\s/g, " "))).toEqual([
      "Billing, Support",
      "1 200",
    ])
  })

  it("writes a yes or no answer as a word, as the extraction's fields do", () => {
    const fields = formFieldsOf(
      form({ hasAccount: true, wantsCall: false }),
      setupI18n({ locale: "en", messages: { en: {} } }),
    )

    expect(fields.map((field) => [field.label, field.value])).toEqual([
      ["Has account", "Yes"],
      ["Wants call", "No"],
    ])
  })
})
