import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Inject, Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import type {
  MaintenanceJob,
  MaintenanceJobPayload,
  MaintenanceJobResult,
} from "./maintenance-job.interface"
import { MAINTENANCE_JOBS, MAINTENANCE_JOBS_QUEUE_NAME } from "./maintenance-jobs.constants"

@Processor(MAINTENANCE_JOBS_QUEUE_NAME)
export class MaintenanceJobsWorker extends WorkerHost {
  private readonly logger = new Logger(MaintenanceJobsWorker.name)

  constructor(@Inject(MAINTENANCE_JOBS) private readonly maintenanceJobs: MaintenanceJob[]) {
    super()
  }

  async process(job: Job<MaintenanceJobPayload>): Promise<MaintenanceJobResult> {
    const maintenanceJob = this.maintenanceJobs.find(
      (registeredJob) => registeredJob.key === job.name,
    )
    if (!maintenanceJob) {
      throw new Error(`Unknown maintenance job: ${job.name}`)
    }
    this.logger.log(`Maintenance job ${job.name} started.`)
    const result = await maintenanceJob.run({
      requestedByUserId: job.data.requestedByUserId,
      reportProgress: (progress) => job.updateProgress(progress),
    })
    this.logger.log(`Maintenance job ${job.name} finished: ${result.summary}`)
    return result
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Maintenance job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
