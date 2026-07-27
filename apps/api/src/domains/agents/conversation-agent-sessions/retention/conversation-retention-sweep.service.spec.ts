import type { Repository } from "typeorm"
import type { LangfuseAdminService } from "@/external/langfuse/langfuse-admin"
import type { ConversationAgentSession } from "../conversation-agent-session.entity"
import type { ConversationAgentSessionPurgeService } from "./conversation-agent-session-purge.service"
import { ConversationRetentionSweepService } from "./conversation-retention-sweep.service"

function buildService(...batches: Partial<ConversationAgentSession>[][]) {
  const getMany = jest.fn().mockResolvedValue([])
  for (const batch of batches) getMany.mockResolvedValueOnce(batch)
  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany,
  }
  const sessionRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  } as unknown as Repository<ConversationAgentSession>
  const purgeService = {
    purgeSessionContent: jest.fn().mockResolvedValue({ purged: true }),
  }
  const langfuseAdminService = {
    deleteTrace: jest.fn().mockResolvedValue(true),
  }
  const service = new ConversationRetentionSweepService(
    sessionRepository,
    purgeService as unknown as ConversationAgentSessionPurgeService,
    langfuseAdminService as unknown as LangfuseAdminService,
  )
  return { service, purgeService, langfuseAdminService }
}

describe("ConversationRetentionSweepService", () => {
  it("purges every expired session and deletes its Langfuse trace", async () => {
    const { service, purgeService, langfuseAdminService } = buildService([
      { id: "session-1", traceId: "trace-1" },
      { id: "session-2", traceId: null as unknown as string },
    ])

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(2)
    expect(purgeService.purgeSessionContent).toHaveBeenCalledTimes(2)
    expect(langfuseAdminService.deleteTrace).toHaveBeenCalledTimes(1)
    expect(langfuseAdminService.deleteTrace).toHaveBeenCalledWith("trace-1")
  })

  it("does not count sessions the purge skipped", async () => {
    const { service, purgeService, langfuseAdminService } = buildService([
      { id: "session-1", traceId: "trace-1" },
    ])
    purgeService.purgeSessionContent.mockResolvedValue({ purged: false })

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(0)
    expect(langfuseAdminService.deleteTrace).not.toHaveBeenCalled()
  })

  it("survives a Langfuse deletion failure", async () => {
    const { service, langfuseAdminService } = buildService([
      { id: "session-1", traceId: "trace-1" },
    ])
    langfuseAdminService.deleteTrace.mockRejectedValue(new Error("boom"))

    const { purgedCount } = await service.sweepExpiredConversations()
    expect(purgedCount).toBe(1)
  })

  it("drains full batches until the backlog is empty", async () => {
    const fullBatch = Array.from({ length: 200 }, (_, index) => ({
      id: `session-${index}`,
      traceId: null as unknown as string,
    }))
    const lastBatch = [{ id: "session-last", traceId: null as unknown as string }]
    const { service, purgeService } = buildService(fullBatch, lastBatch)

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(201)
    expect(purgeService.purgeSessionContent).toHaveBeenCalledTimes(201)
  })
})
