import {
  CONVERSATION_RUN_RECORDS_PAGE_SIZE,
  EvalConversationRunsRoutes,
} from "@caseai-connect/eval-contracts"
import { describe, expect, it } from "vitest"
import { createQueryClient } from "@/app/query-client"
import { buildConversationRunRecord } from "@/test/factories/conversation-runs.factory"
import { mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { conversationRunRecordsQueryOptions } from "./queries"

/** A run whose records the API pages, and the pages each read asked. */
function serveRunRecords(recordCount: number) {
  const run = {
    organizationId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    evaluationConversationRunId: crypto.randomUUID(),
  }
  const records = Array.from({ length: recordCount }, () =>
    buildConversationRunRecord({ status: "running", output: null, score: null }),
  )
  const askedPages: number[] = []
  server.use(
    mockRoute(EvalConversationRunsRoutes.getRecords, ({ query }) => {
      askedPages.push(query.page)
      const start = query.page * query.limit
      return {
        records: records.slice(start, start + query.limit),
        total: records.length,
        page: query.page,
        limit: query.limit,
      }
    }),
  )
  return { run, records, askedPages }
}

describe("conversationRunRecordsQueryOptions", () => {
  it("reads every page of a run's records", async () => {
    const { run, records, askedPages } = serveRunRecords(CONVERSATION_RUN_RECORDS_PAGE_SIZE * 2 + 1)
    const queryClient = createQueryClient({ isRetrying: false })

    const read = await queryClient.fetchQuery(conversationRunRecordsQueryOptions(run))

    expect(read.map((record) => record.id)).toEqual(records.map((record) => record.id))
    expect([...askedPages].sort()).toEqual([0, 1, 2])
  })

  it("reads again only the pages that hold a record still waiting", async () => {
    const { run, records, askedPages } = serveRunRecords(CONVERSATION_RUN_RECORDS_PAGE_SIZE * 2)
    const queryClient = createQueryClient({ isRetrying: false })
    const options = conversationRunRecordsQueryOptions(run, { isActive: true })
    // The first page is graded at the first read; the second still waits.
    for (const record of records.slice(0, CONVERSATION_RUN_RECORDS_PAGE_SIZE)) {
      record.status = "graded"
      record.score = 4
    }
    await queryClient.fetchQuery(options)
    const lastRecord = records.at(-1)
    if (!lastRecord) throw new Error("expected records")
    lastRecord.status = "graded"
    lastRecord.score = 3
    askedPages.length = 0

    await queryClient.refetchQueries({ queryKey: options.queryKey })

    expect(askedPages).toEqual([1])
    expect(queryClient.getQueryData(options.queryKey)?.at(-1)?.score).toBe(3)
  })
})
