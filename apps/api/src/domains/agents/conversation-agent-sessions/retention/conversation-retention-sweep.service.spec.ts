import type { Repository } from "typeorm"
import type { ConversationAgentSession } from "../conversation-agent-session.entity"
import type { ConversationAgentSessionPurgeService } from "./conversation-agent-session-purge.service"
import { ConversationRetentionSweepService } from "./conversation-retention-sweep.service"
import type { ConversationRetentionSweepRun } from "./conversation-retention-sweep-run.entity"

function buildService(...batches: Partial<ConversationAgentSession>[][]) {
  return buildServiceWithPublicBatches({ batches, publicBatches: [] })
}

function buildServiceWithPublicBatches({
  batches,
  publicBatches,
}: {
  batches: Partial<ConversationAgentSession>[][]
  publicBatches: { id: string }[][]
}) {
  const managerQuery = jest.fn().mockResolvedValue([])
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
  const getRawMany = jest.fn().mockResolvedValue([])
  for (const batch of publicBatches) getRawMany.mockResolvedValueOnce(batch)
  const rawQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany,
  }
  const sessionRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(rawQueryBuilder),
      query: managerQuery,
    },
  } as unknown as Repository<ConversationAgentSession>
  const purgeService = {
    purgeSessionContent: jest.fn().mockResolvedValue({ purged: true }),
    purgePublicSessionContent: jest.fn().mockResolvedValue({ purged: true }),
  }
  const insert = jest.fn().mockResolvedValue(undefined)
  const sweepRunRepository = {
    create: jest.fn((row: unknown) => row),
    insert,
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    }),
  } as unknown as Repository<ConversationRetentionSweepRun>
  const service = new ConversationRetentionSweepService(
    sessionRepository,
    sweepRunRepository,
    purgeService as unknown as ConversationAgentSessionPurgeService,
  )
  return {
    service,
    purgeService,
    queryBuilder,
    rawQueryBuilder,
    insert,
    managerQuery,
  }
}

describe("ConversationRetentionSweepService", () => {
  it("purges every expired session", async () => {
    const { service, purgeService } = buildService([{ id: "session-1" }, { id: "session-2" }])

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(2)
    expect(purgeService.purgeSessionContent).toHaveBeenCalledTimes(2)
  })

  it("leaves review-campaign sessions out of the purge", async () => {
    const { service, queryBuilder } = buildService([])

    await service.sweepExpiredConversations()

    expect(queryBuilder.andWhere).toHaveBeenCalledWith("session.campaign_id IS NULL")
    expect(queryBuilder.andWhere).toHaveBeenCalledWith("session.type <> 'review_campaign_tester'")
  })

  it("does not count sessions the purge skipped", async () => {
    const { service, purgeService } = buildService([{ id: "session-1" }])
    purgeService.purgeSessionContent.mockResolvedValue({ purged: false })

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(0)
  })

  it("continues past a failed purge, so the next run retries that session", async () => {
    const { service, purgeService, rawQueryBuilder } = buildService([
      { id: "session-1" },
      { id: "session-2" },
    ])
    purgeService.purgeSessionContent.mockRejectedValueOnce(new Error("boom"))

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(1)
    expect(purgeService.purgeSessionContent).toHaveBeenCalledTimes(2)
    expect(purgeService.purgeSessionContent).toHaveBeenLastCalledWith("session-2")
    // the failed session is excluded from the later queries of the same run
    // (here the public pass, which runs after the conversation pass)
    expect(rawQueryBuilder.andWhere).toHaveBeenCalledWith(
      "session.id NOT IN (:...excludedSessionIds)",
      { excludedSessionIds: ["session-1"] },
    )
  })

  it("excludes an in-run failure from the next conversation batch", async () => {
    const fullBatch = Array.from({ length: 200 }, (_, index) => ({ id: `session-${index}` }))
    const { service, purgeService, queryBuilder } = buildService(fullBatch, [])
    purgeService.purgeSessionContent.mockRejectedValueOnce(new Error("boom"))

    await service.sweepExpiredConversations()

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "session.id NOT IN (:...excludedSessionIds)",
      { excludedSessionIds: ["session-0"] },
    )
  })

  it("drains full batches until the backlog is empty", async () => {
    const fullBatch = Array.from({ length: 200 }, (_, index) => ({ id: `session-${index}` }))
    const lastBatch = [{ id: "session-last" }]
    const { service, purgeService } = buildService(fullBatch, lastBatch)

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(201)
    expect(purgeService.purgeSessionContent).toHaveBeenCalledTimes(201)
  })

  it("purges expired public sessions", async () => {
    const { service, purgeService } = buildServiceWithPublicBatches({
      batches: [],
      publicBatches: [[{ id: "public-1" }, { id: "public-2" }]],
    })

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(2)
    expect(purgeService.purgePublicSessionContent).toHaveBeenCalledTimes(2)
  })

  it("continues past a failed public purge", async () => {
    const { service, purgeService } = buildServiceWithPublicBatches({
      batches: [],
      publicBatches: [[{ id: "public-1" }, { id: "public-2" }]],
    })
    purgeService.purgePublicSessionContent.mockRejectedValueOnce(new Error("boom"))

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(1)
    expect(purgeService.purgePublicSessionContent).toHaveBeenCalledTimes(2)
    expect(purgeService.purgePublicSessionContent).toHaveBeenLastCalledWith("public-2")
  })

  it("counts internal and public sessions together", async () => {
    const { service } = buildServiceWithPublicBatches({
      batches: [[{ id: "session-1" }]],
      publicBatches: [[{ id: "public-1" }]],
    })

    const { purgedCount } = await service.sweepExpiredConversations()

    expect(purgedCount).toBe(2)
  })

  it("writes one log row per project, zero counts included", async () => {
    const { service, insert, managerQuery } = buildService([
      { id: "session-1", projectId: "project-a" },
    ])
    managerQuery.mockResolvedValue([{ id: "project-a" }, { id: "project-b" }])

    await service.sweepExpiredConversations()

    expect(insert).toHaveBeenCalledTimes(1)
    const rows = insert.mock.calls[0]?.[0] as {
      projectId: string
      purgedCount: number
      status: string
      report: string
    }[]
    const projectARow = rows.find((row) => row.projectId === "project-a")
    const projectBRow = rows.find((row) => row.projectId === "project-b")
    expect(projectARow).toMatchObject({ purgedCount: 1, status: "OK" })
    expect(projectARow?.report).toContain("Conversations purged: 1")
    expect(projectBRow).toMatchObject({ purgedCount: 0, status: "OK" })
  })

  it("marks a project PARTIAL in the log when a purge failed", async () => {
    const { service, insert, managerQuery, purgeService } = buildService([
      { id: "session-1", projectId: "project-a" },
    ])
    managerQuery.mockResolvedValue([{ id: "project-a" }])
    purgeService.purgeSessionContent.mockRejectedValueOnce(new Error("boom"))

    await service.sweepExpiredConversations()

    const rows = insert.mock.calls[0]?.[0] as { status: string; report: string }[]
    expect(rows[0]).toMatchObject({ status: "PARTIAL", purgedCount: 0 })
    expect(rows[0]?.report).toContain("Purge failures: 1")
  })
})
