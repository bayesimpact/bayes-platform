import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { buildConversationAgentPrompt } from "./conversation-agent.prompt"
import { promptHelpers } from "./helpers"

describe("promptHelpers.interfaceMarkup", () => {
  it("explains the quotes and the ticked tasks the chat interface adds to messages", () => {
    const section = promptHelpers.interfaceMarkup()

    expect(section).toContain('<quote reply="…" occurrence="…">')
    expect(section).toContain('<checked reply="…" item="…">')
    expect(section).toContain("<unchecked")
    // The interface already shows the ticks: the agent does not rewrite its list.
    expect(section).toContain("Do not rewrite the list")
  })

  it("asks for a Markdown task list when the user will tick the items off", () => {
    const section = promptHelpers.interfaceMarkup()

    expect(section).toContain("- [ ] ")
    expect(section).toMatch(/shopping list/)
  })

  it("stands in the prompt only when asked, before the date that changes daily", () => {
    const organization = organizationFactory.build()
    const project = projectFactory.transient({ organization }).build()
    const agent = agentFactory.transient({ organization, project }).build({ resourceLibraries: [] })
    const promptOf = (hasChatInterfacePrompt: boolean) =>
      buildConversationAgentPrompt({
        agent,
        agentSettings: agentSettingsFactory.transient({ organization, project, agent }).build(),
        toolNames: [],
        hasChatInterfacePrompt,
      })

    const prompt = promptOf(true)
    const sectionAt = prompt.indexOf(promptHelpers.interfaceMarkup())
    expect(sectionAt).toBeGreaterThan(-1)
    expect(sectionAt).toBeLessThan(prompt.indexOf("Today's date:"))
    expect(promptOf(false)).not.toContain("## The chat interface")
  })
})
