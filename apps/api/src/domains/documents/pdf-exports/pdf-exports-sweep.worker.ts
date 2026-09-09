import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { PDF_EXPORTS_SWEEP_QUEUE_NAME } from "./pdf-exports.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfExportsSweepService } from "./pdf-exports-sweep.service"

@Processor(PDF_EXPORTS_SWEEP_QUEUE_NAME)
export class PdfExportsSweepWorker extends WorkerHost {
  private readonly logger = new Logger(PdfExportsSweepWorker.name)

  constructor(private readonly pdfExportsSweepService: PdfExportsSweepService) {
    super()
  }

  async process(_job: Job): Promise<void> {
    const { scanned, deleted, failed, skipped } =
      await this.pdfExportsSweepService.sweepExpiredExports()
    if (skipped) {
      return
    }
    this.logger.log(
      `PDF export sweep finished (${scanned} scanned, ${deleted} deleted, ${failed} failed).`,
    )
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
