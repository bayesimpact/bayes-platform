import { agentEmbedConfigFactory } from "./agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "./public-agent-sessions/public-agent-session.factory"
import { toEmbedPublicConfigDto, toPublicAgentSessionDto } from "./public-chat.mappers"

describe("public chat mappers", () => {
  it("exposes branding only from the embed configuration", () => {
    const embedConfig = agentEmbedConfigFactory.build({
      title: "Help Center",
      logoUrl: null,
      primaryColor: "#2563eb",
      bannerText: null,
    })
    embedConfig.agent = { name: "Helpful Assistant" } as typeof embedConfig.agent

    expect(toEmbedPublicConfigDto(embedConfig)).toEqual({
      agentName: "Helpful Assistant",
      title: "Help Center",
      logoUrl: null,
      primaryColor: "#2563eb",
      bannerText: null,
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
    expect("status" in dto.messages[0]! && dto.messages[0].status).toBeUndefined()
  })
})
