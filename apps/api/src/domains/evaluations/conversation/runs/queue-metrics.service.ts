import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"
import { metrics } from "@opentelemetry/api"
import type { Queue } from "bullmq"
import {
  EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_CONVERSATION_RUN_QUEUE_NAME,
} from "./evaluation-conversation-run.constants"

type QueueCounts = { waiting: number; active: number; completed: number; failed: number }

const QUEUE_METRICS_INTERVAL_MS = 30_000
const EMPTY_COUNTS: QueueCounts = { waiting: 0, active: 0, completed: 0, failed: 0 }

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name)
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

  private lastCountsByQueue: Map<string, QueueCounts> = new Map([
    [EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME, { ...EMPTY_COUNTS }],
    [EVALUATION_CONVERSATION_RUN_QUEUE_NAME, { ...EMPTY_COUNTS }],
  ])

  constructor(
    @InjectQueue(EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME)
    private readonly executeQueue: Queue,
    @InjectQueue(EVALUATION_CONVERSATION_RUN_QUEUE_NAME)
    private readonly recordQueue: Queue,
  ) {
    this.waitingGauge.addCallback((result) => {
      for (const [queueName, counts] of this.lastCountsByQueue) {
        result.observe(counts.waiting, { queue: queueName })
      }
    })
    this.activeGauge.addCallback((result) => {
      for (const [queueName, counts] of this.lastCountsByQueue) {
        result.observe(counts.active, { queue: queueName })
      }
    })
    this.completedGauge.addCallback((result) => {
      for (const [queueName, counts] of this.lastCountsByQueue) {
        result.observe(counts.completed, { queue: queueName })
      }
    })
    this.failedGauge.addCallback((result) => {
      for (const [queueName, counts] of this.lastCountsByQueue) {
        result.observe(counts.failed, { queue: queueName })
      }
    })
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
    const queues: Array<[string, Queue]> = [
      [EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME, this.executeQueue],
      [EVALUATION_CONVERSATION_RUN_QUEUE_NAME, this.recordQueue],
    ]

    await Promise.all(
      queues.map(async ([queueName, queue]) => {
        try {
          const counts = await queue.getJobCounts()
          this.lastCountsByQueue.set(queueName, counts as QueueCounts)
          this.logger.debug(
            `queue_metrics queue=${queueName} waiting=${counts.waiting} active=${counts.active} completed=${counts.completed} failed=${counts.failed}`,
          )
        } catch (error) {
          this.logger.error(
            `Failed to collect queue metrics for ${queueName}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }),
    )
  }
}
