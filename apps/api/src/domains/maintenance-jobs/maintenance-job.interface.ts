export type MaintenanceJobPreview = {
  /** How many items the job still has to handle. Zero means there is nothing left to run. */
  remainingCount: number
  /** The same, in words, for the backoffice. */
  remainingSummary: string
}

export type MaintenanceJobProgress = { done: number; total: number }

export type MaintenanceJobRunContext = {
  /** The superadmin who started the run, recorded as the author of what the job creates. */
  requestedByUserId: string
  reportProgress: (progress: MaintenanceJobProgress) => Promise<void>
}

export type MaintenanceJobResult = {
  /** What the run did, shown in the backoffice. */
  summary: string
}

/** BullMQ payload of a maintenance job run. The job name is the key of the job. */
export type MaintenanceJobPayload = {
  requestedByUserId: string
}

/**
 * A one-off data migration run in the workers across every organization, started from the
 * backoffice. A run must be idempotent: running it again only handles what is left. Remove the
 * job from the code once its preview is zero on every platform.
 */
export interface MaintenanceJob {
  /** Stable identifier, used as the BullMQ job name and job id. */
  readonly key: string
  readonly title: string
  readonly description: string
  preview(): Promise<MaintenanceJobPreview>
  run(context: MaintenanceJobRunContext): Promise<MaintenanceJobResult>
}
