import { getQueueToken } from "@nestjs/bullmq"
import type { TestingModuleBuilder } from "@nestjs/testing"
import type { JobState } from "bullmq"
import type {
  MaintenanceJob,
  MaintenanceJobPayload,
  MaintenanceJobResult,
} from "../maintenance-job.interface"
import { MAINTENANCE_JOBS, MAINTENANCE_JOBS_QUEUE_NAME } from "../maintenance-jobs.constants"

type FakeRun = {
  name: string
  data: MaintenanceJobPayload
  timestamp: number
  finishedOn?: number
  progress: unknown
  returnvalue?: MaintenanceJobResult
  failedReason: string
  state: JobState
  getState: () => Promise<JobState>
  remove: () => Promise<void>
}

/** The BullMQ queue of the maintenance jobs, kept in memory: only what the service reads. */
export class FakeMaintenanceJobsQueue {
  readonly runs = new Map<string, FakeRun>()

  async getJob(jobId: string): Promise<FakeRun | undefined> {
    return this.runs.get(jobId)
  }

  async add(
    name: string,
    data: MaintenanceJobPayload,
    options: { jobId: string },
  ): Promise<FakeRun> {
    const existing = this.runs.get(options.jobId)
    if (existing) return existing
    const run: FakeRun = {
      name,
      data,
      timestamp: Date.now(),
      progress: 0,
      failedReason: "",
      state: "waiting",
      getState: async () => run.state,
      remove: async () => {
        this.runs.delete(options.jobId)
      },
    }
    this.runs.set(options.jobId, run)
    return run
  }

  /** A finished run, as the workers leave it. */
  finish(jobId: string, outcome: { summary: string } | { error: string }): void {
    const run = this.runs.get(jobId)
    if (!run) throw new Error(`No run ${jobId}`)
    run.finishedOn = Date.now()
    run.progress = { done: 2, total: 2 }
    if ("summary" in outcome) {
      run.state = "completed"
      run.returnvalue = { summary: outcome.summary }
    } else {
      run.state = "failed"
      run.failedReason = outcome.error
    }
  }
}

export const sampleMaintenanceJob: MaintenanceJob = {
  key: "sample-maintenance-job",
  title: "Sample maintenance job",
  description: "Moves sample records to their new shape.",
  preview: async () => ({ remainingCount: 2, remainingSummary: "2 records" }),
  run: async () => ({ summary: "2 records moved." }),
}

export function withFakeMaintenanceJobs(
  moduleBuilder: TestingModuleBuilder,
  queue: FakeMaintenanceJobsQueue,
): TestingModuleBuilder {
  return moduleBuilder
    .overrideProvider(getQueueToken(MAINTENANCE_JOBS_QUEUE_NAME))
    .useValue(queue)
    .overrideProvider(MAINTENANCE_JOBS)
    .useValue([sampleMaintenanceJob])
}
