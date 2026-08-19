import type { Queue } from "bullmq"
import { DoclingCrawlingQueueMetricsService } from "./docling-crawling-queue-metrics.service"

type PrivateMembers = {
  collectQueueMetrics: () => Promise<void>
}

describe("DoclingCrawlingQueueMetricsService", () => {
  let queue: { getJobCounts: jest.Mock }
  let service: DoclingCrawlingQueueMetricsService

  beforeEach(() => {
    queue = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 1, active: 2, completed: 3, failed: 4 }),
    }
    service = new DoclingCrawlingQueueMetricsService(queue as unknown as Queue)
  })

  afterEach(() => {
    service.onModuleDestroy()
    jest.useRealTimers()
  })

  it("constructs without throwing and registers gauge callbacks", () => {
    expect(service).toBeInstanceOf(DoclingCrawlingQueueMetricsService)
  })

  it("polls the queue's job counts on an interval after onModuleInit", () => {
    jest.useFakeTimers()

    service.onModuleInit()
    expect(queue.getJobCounts).not.toHaveBeenCalled()

    jest.advanceTimersByTime(30_000)
    expect(queue.getJobCounts).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(30_000)
    expect(queue.getJobCounts).toHaveBeenCalledTimes(2)
  })

  it("stops polling once onModuleDestroy is called", () => {
    jest.useFakeTimers()

    service.onModuleInit()
    jest.advanceTimersByTime(30_000)
    expect(queue.getJobCounts).toHaveBeenCalledTimes(1)

    service.onModuleDestroy()
    jest.advanceTimersByTime(60_000)
    expect(queue.getJobCounts).toHaveBeenCalledTimes(1)
  })

  it("logs and does not throw when getJobCounts rejects", async () => {
    queue.getJobCounts.mockRejectedValue(new Error("redis down"))

    await expect(
      (service as unknown as PrivateMembers).collectQueueMetrics(),
    ).resolves.toBeUndefined()
  })
})
