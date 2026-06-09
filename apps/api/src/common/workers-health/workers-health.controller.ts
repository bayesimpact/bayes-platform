import { InjectQueue } from "@nestjs/bullmq"
import { Controller, Get, HttpException, HttpStatus, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { Queue } from "bullmq"
import type { DataSource } from "typeorm"
import { WORKERS_HEALTH_QUEUE_NAME } from "./workers-health.constants"

type CheckResult = { ok: true } | { ok: false; error: string }

@Controller("healthz")
export class WorkersHealthController {
  private readonly logger = new Logger(WorkersHealthController.name)

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectQueue(WORKERS_HEALTH_QUEUE_NAME) private readonly bullmqQueue: Queue,
  ) {}

  @Get()
  async check(): Promise<{ postgres: CheckResult; redis: CheckResult }> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()])
    const body = { postgres, redis }
    if (!postgres.ok || !redis.ok) {
      this.logger.error(`Health check failed: ${JSON.stringify(body)}`)
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE)
    }
    return body
  }

  private async checkPostgres(): Promise<CheckResult> {
    try {
      await this.dataSource.query("SELECT 1")
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    try {
      const client = await this.bullmqQueue.client
      const pong = await client.ping()
      if (pong !== "PONG") {
        return { ok: false, error: `Unexpected ping response: ${pong}` }
      }
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
