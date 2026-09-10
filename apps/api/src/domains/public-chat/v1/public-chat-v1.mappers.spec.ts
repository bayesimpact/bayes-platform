import { agentFactory } from "@/domains/agents/agent.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { agentEmbedConfigFactory } from "../agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "../public-agent-sessions/public-agent-session.factory"
import {
  toCreatePublicSessionResponseDto,
  toEmbedPublicConfigDto,
  toPublicAgentSessionDto,
} from "./public-chat-v1.mappers"

describe("public chat v1 mappers", () => {
  it("exposes branding only from the embed configuration", () => {
    const organization = organizationFactory.build()
    const project = projectFactory.transient({ organization }).build()
    const agent = agentFactory
      .transient({ organization, project })
      .build({ name: "Helpful Assistant" })
    const embedConfig = agentEmbedConfigFactory.transient({ organization, project, agent }).build({
      title: "Help Center",
      logoUrl: null,
      primaryColor: "#2563eb",
      bannerText: null,
    })

    expect(toEmbedPublicConfigDto(embedConfig)).toEqual({
      agentName: "Helpful Assistant",
      title: "Help Center",
      logoUrl: null,
      primaryColor: "#2563eb",
      bannerText: null,
    })
  })

  it("exposes the session id and the clear session token once", () => {
    const session = publicAgentSessionFactory.build()

    expect(toCreatePublicSessionResponseDto(session, "token-1")).toEqual({
      sessionId: session.id,
      sessionToken: "token-1",
    })
  })

  it("maps messages with millisecond times and drops null optionals", () => {
    const session = publicAgentSessionFactory.build()
    const createdAt = new Date("2026-01-01T10:00:00Z")
    const dto = toPublicAgentSessionDto(session, [
      {
        id: "message-1",
        role: "assistant",
        content: "Hello",
        status: null,
        createdAt,
        toolCalls: null,
      },
    ])

    expect(dto.id).toBe(session.id)
    expect(dto.agentId).toBe(session.agentId)
    expect(dto.createdAt).toBe(session.createdAt.getTime())
    expect(dto.messages).toEqual([
      { id: "message-1", role: "assistant", content: "Hello", createdAt: createdAt.getTime() },
    ])
    expect(dto.messages[0]?.status).toBeUndefined()
    expect(dto.messages[0]?.toolCalls).toBeUndefined()
  })
})
