import { describe, expect, it } from "vitest"
import { buildStreamRequest } from "./agent-session-messages-streaming-request"

const params = {
  baseURL: "https://api.example.test",
  type: "live" as const,
  organizationId: "org-1",
  projectId: "project-1",
  agentId: "agent-1",
  agentSessionId: "session-1",
}

describe("buildStreamRequest", () => {
  it("carries the chosen settings revision", () => {
    const { body } = buildStreamRequest({ ...params, content: "Hello", agentSettingsRevision: 3 })

    expect(body.payload.agentSettingsRevision).toBe(3)
  })

  it("omits the revision when none was chosen", () => {
    const { body } = buildStreamRequest({ ...params, content: "Hello" })

    expect(body.payload).not.toHaveProperty("agentSettingsRevision")
  })

  it("keeps the content and the attachment in the body", () => {
    const { body } = buildStreamRequest({
      ...params,
      content: "Hello",
      attachmentDocumentId: "attachment-1",
    })

    expect(body.payload).toMatchObject({
      content: "Hello",
      attachmentDocumentId: "attachment-1",
    })
  })

  it("keeps the message out of the URL", () => {
    const { url } = buildStreamRequest({ ...params, content: "A private message" })

    expect(new URL(url).search).toBe("")
    expect(url).not.toContain("private")
  })

  it("points a live session at the live stream path", () => {
    const { url } = buildStreamRequest({ ...params, content: "Hello" })

    expect(new URL(url).pathname).toBe(
      "/organizations/org-1/projects/project-1/agents/agent-1/agent-sessions/live/session-1/messages/stream",
    )
  })

  it("points a playground session at the playground stream path", () => {
    const { url } = buildStreamRequest({ ...params, type: "playground", content: "Hello" })

    expect(new URL(url).pathname).toBe(
      "/organizations/org-1/projects/project-1/agents/agent-1/agent-sessions/playground/session-1/messages/stream",
    )
  })
})
