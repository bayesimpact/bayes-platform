import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import type { Queue } from "bullmq"
import { getPdfExportSweepIntervalSeconds } from "./pdf-exports.config"
import {
  PDF_EXPORTS_SWEEP_JOB_NAME,
  PDF_EXPORTS_SWEEP_QUEUE_NAME,
  PDF_EXPORTS_SWEEP_SCHEDULER_ID,
} from "./pdf-exports.constants"

@Injectable()
export class PdfExportsSweepSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PdfExportsSweepSchedulerService.name)

  constructor(
    @InjectQueue(PDF_EXPORTS_SWEEP_QUEUE_NAME)
    private readonly pdfExportsSweepQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const sweepIntervalSeconds = getPdfExportSweepIntervalSeconds()

    await this.pdfExportsSweepQueue.upsertJobScheduler(
      PDF_EXPORTS_SWEEP_SCHEDULER_ID,
      { every: sweepIntervalSeconds * 1000 },
      {
        name: PDF_EXPORTS_SWEEP_JOB_NAME,
        data: {},
      },
    )

    this.logger.log(
      `Registered PDF export sweep scheduler (every ${sweepIntervalSeconds} s, queue ${PDF_EXPORTS_SWEEP_QUEUE_NAME}).`,
    )
  }
}
