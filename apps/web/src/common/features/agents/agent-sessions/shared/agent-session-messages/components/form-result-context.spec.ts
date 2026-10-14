import { describe, expect, it } from "vitest"
import { type FormResultEntry, listConversationForms } from "./form-result-context"

const schema = { type: "object", properties: { title: { type: "string" } } }
const ownForm: FormResultEntry = {
  agentId: "agent-root",
  agentName: "Helpful Assistant",
  outputJsonSchema: schema,
  result: { title: "Pricing" },
}
const subAgentForm: FormResultEntry = {
  agentId: "agent-sub",
  agentName: "Support Assistant",
  outputJsonSchema: schema,
}

describe("listConversationForms", () => {
  it("lists nothing when no agent of the conversation has a form", () => {
    expect(listConversationForms(null)).toEqual({ forms: [], hasSubAgentForms: false })
  })

  it("does not count the session's own form as a sub-agent form", () => {
    const value = { rootAgentId: ownForm.agentId, byAgentId: { [ownForm.agentId]: ownForm } }
    expect(listConversationForms(value)).toEqual({ forms: [ownForm], hasSubAgentForms: false })
  })

  it("lists the session's own form first, then the sub-agent forms", () => {
    const value = {
      rootAgentId: ownForm.agentId,
      byAgentId: { [subAgentForm.agentId]: subAgentForm, [ownForm.agentId]: ownForm },
    }
    expect(listConversationForms(value)).toEqual({
      forms: [ownForm, subAgentForm],
      hasSubAgentForms: true,
    })
  })

  it("counts a sub-agent form when the session's agent has none", () => {
    const value = {
      rootAgentId: ownForm.agentId,
      byAgentId: { [subAgentForm.agentId]: subAgentForm },
    }
    expect(listConversationForms(value)).toEqual({ forms: [subAgentForm], hasSubAgentForms: true })
  })
})
