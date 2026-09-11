import { Controller, Get, HttpException, HttpStatus, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"

type CheckResult = { ok: true } | { ok: false; error: string }

/**
 * Liveness and readiness of the API process, served at `/api/healthz`
 * (Kubernetes probes, uptime monitors). Postgres is the one dependency every
 * request needs; the queues are checked by the workers' own health route.
 */
@Controller("healthz")
export class HealthController {
  private readonly logger = new Logger(HealthController.name)

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{ postgres: CheckResult }> {
    const postgres = await this.checkPostgres()
    const body = { postgres }
    if (!postgres.ok) {
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
}
