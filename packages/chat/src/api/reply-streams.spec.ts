import { describe, expect, it } from "vitest"
import { createReplyStreams } from "./reply-streams"

describe("createReplyStreams", () => {
  it("stops the stream of the previous reply of a conversation when a new one starts", () => {
    const replyStreams = createReplyStreams()
    const agentSessionId = crypto.randomUUID()

    const first = replyStreams.register(agentSessionId)
    const second = replyStreams.register(agentSessionId)

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
    expect(replyStreams.isStreaming(agentSessionId)).toBe(true)
  })

  it("stops only the conversation the person leaves", () => {
    const replyStreams = createReplyStreams()
    const left = crypto.randomUUID()
    const stayed = crypto.randomUUID()
    const leftController = replyStreams.register(left)
    const stayedController = replyStreams.register(stayed)

    replyStreams.stop(left)

    expect(leftController.signal.aborted).toBe(true)
    expect(stayedController.signal.aborted).toBe(false)
  })

  it("forgets a stream once it ends, unless a newer reply replaced it", () => {
    const replyStreams = createReplyStreams()
    const agentSessionId = crypto.randomUUID()
    const first = replyStreams.register(agentSessionId)
    const second = replyStreams.register(agentSessionId)

    replyStreams.unregister(agentSessionId, first)
    expect(replyStreams.isStreaming(agentSessionId)).toBe(true)

    replyStreams.unregister(agentSessionId, second)
    expect(replyStreams.isStreaming(agentSessionId)).toBe(false)
  })

  it("does not share its streams with another chat's", () => {
    const agentSessionId = crypto.randomUUID()
    const first = createReplyStreams()
    const second = createReplyStreams()

    first.register(agentSessionId)

    expect(second.isStreaming(agentSessionId)).toBe(false)
  })
})
