import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"
import { metrics } from "@opentelemetry/api"
import type { Queue } from "bullmq"
import { EXTRACTION_AGENT_SESSION_QUEUE_NAME } from "./extraction-agent-session.constants"

const QUEUE_METRICS_INTERVAL_MS = 30_000

@Injectable()
export class ExtractionAgentSessionQueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExtractionAgentSessionQueueMetricsService.name)
  private intervalHandle: NodeJS.Timeout | null = null

  private readonly meter = metrics.getMeter("bullmq")
  private readonly waitingGauge = this.meter.createObservableGauge("bullmq.queue.waiting", {
    description: "Number of waiting jobs in the queue",
  })
  private readonly activeGauge = this.meter.createObservableGauge("bullmq.queue.active", {
    description: "Number of active jobs in the queue",
  })
  private readonly completedGauge = this.meter.createObservableGauge("bullmq.queue.completed", {
    description: "Number of completed jobs in the queue",
  })
  private readonly failedGauge = this.meter.createObservableGauge("bullmq.queue.failed", {
    description: "Number of failed jobs in the queue",
  })

  private lastCounts: Record<string, number> = { waiting: 0, active: 0, completed: 0, failed: 0 }

  constructor(
    @InjectQueue(EXTRACTION_AGENT_SESSION_QUEUE_NAME)
    private readonly extractionAgentSessionQueue: Queue,
  ) {
    const queueAttr = { queue: EXTRACTION_AGENT_SESSION_QUEUE_NAME }
    this.waitingGauge.addCallback((result) =>
      result.observe(this.lastCounts.waiting ?? 0, queueAttr),
    )
    this.activeGauge.addCallback((result) => result.observe(this.lastCounts.active ?? 0, queueAttr))
    this.completedGauge.addCallback((result) =>
      result.observe(this.lastCounts.completed ?? 0, queueAttr),
    )
    this.failedGauge.addCallback((result) => result.observe(this.lastCounts.failed ?? 0, queueAttr))
  }

  onModuleInit() {
    this.intervalHandle = setInterval(() => {
      void this.collectQueueMetrics()
    }, QUEUE_METRICS_INTERVAL_MS)
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  private async collectQueueMetrics(): Promise<void> {
    try {
      this.lastCounts = await this.extractionAgentSessionQueue.getJobCounts()
      this.logger.debug(
        `queue_metrics queue=${EXTRACTION_AGENT_SESSION_QUEUE_NAME} waiting=${this.lastCounts.waiting} active=${this.lastCounts.active} completed=${this.lastCounts.completed} failed=${this.lastCounts.failed}`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to collect queue metrics: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
