import type {
  BackofficeMaintenanceJobDto,
  BackofficeMaintenanceJobRunDto,
  BackofficeMaintenanceJobRunState,
} from "@caseai-connect/api-contracts"
import { InjectQueue } from "@nestjs/bullmq"
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import type { Job, JobState, Queue } from "bullmq"
import type {
  MaintenanceJob,
  MaintenanceJobPayload,
  MaintenanceJobProgress,
  MaintenanceJobResult,
} from "./maintenance-job.interface"
import { MAINTENANCE_JOBS, MAINTENANCE_JOBS_QUEUE_NAME } from "./maintenance-jobs.constants"

type MaintenanceJobRun = Job<MaintenanceJobPayload, MaintenanceJobResult>

/**
 * Lists the maintenance jobs and starts them. A job's run is the BullMQ job whose id is the job
 * key: one run at a time, and the last run stays in Redis so the backoffice can show how it ended.
 */
@Injectable()
export class MaintenanceJobsService {
  constructor(
    @InjectQueue(MAINTENANCE_JOBS_QUEUE_NAME)
    private readonly queue: Queue<MaintenanceJobPayload, MaintenanceJobResult>,
    @Inject(MAINTENANCE_JOBS) private readonly maintenanceJobs: MaintenanceJob[],
  ) {}

  list(): Promise<BackofficeMaintenanceJobDto[]> {
    return Promise.all(this.maintenanceJobs.map((maintenanceJob) => this.toDto(maintenanceJob)))
  }

  async run({
    jobKey,
    requestedByUserId,
  }: {
    jobKey: string
    requestedByUserId: string
  }): Promise<BackofficeMaintenanceJobDto> {
    const maintenanceJob = this.maintenanceJobs.find(
      (registeredJob) => registeredJob.key === jobKey,
    )
    if (!maintenanceJob) {
      throw new NotFoundException(`Maintenance job ${jobKey} not found`)
    }

    const previousRun = await this.queue.getJob(jobKey)
    if (previousRun) {
      const state = await previousRun.getState()
      if (state !== "completed" && state !== "failed") {
        throw new ConflictException(`Maintenance job ${jobKey} is already running`)
      }
      // BullMQ ignores an add whose job id still exists, finished or not.
      await previousRun.remove()
    }

    await this.queue.add(jobKey, { requestedByUserId }, { jobId: jobKey })
    return this.toDto(maintenanceJob)
  }

  private async toDto(maintenanceJob: MaintenanceJob): Promise<BackofficeMaintenanceJobDto> {
    const [preview, lastRun] = await Promise.all([
      maintenanceJob.preview(),
      this.getLastRun(maintenanceJob.key),
    ])
    return {
      key: maintenanceJob.key,
      title: maintenanceJob.title,
      description: maintenanceJob.description,
      remainingCount: preview.remainingCount,
      remainingSummary: preview.remainingSummary,
      lastRun,
    }
  }

  private async getLastRun(jobKey: string): Promise<BackofficeMaintenanceJobRunDto | null> {
    const run: MaintenanceJobRun | undefined = await this.queue.getJob(jobKey)
    if (!run) {
      return null
    }
    const state = toRunState(await run.getState())
    return {
      state,
      requestedAt: run.timestamp,
      finishedAt: run.finishedOn ?? null,
      progress: isProgress(run.progress) ? run.progress : null,
      summary: run.returnvalue?.summary ?? null,
      error: state === "failed" ? run.failedReason || null : null,
    }
  }
}

function toRunState(state: JobState | "unknown"): BackofficeMaintenanceJobRunState {
  if (state === "completed" || state === "failed" || state === "active") {
    return state
  }
  return "waiting"
}

function isProgress(progress: unknown): progress is MaintenanceJobProgress {
  return (
    typeof progress === "object" &&
    progress !== null &&
    typeof (progress as MaintenanceJobProgress).done === "number" &&
    typeof (progress as MaintenanceJobProgress).total === "number"
  )
}
