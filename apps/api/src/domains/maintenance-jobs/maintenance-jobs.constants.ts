const DEFAULT_MAINTENANCE_JOBS_QUEUE_NAME = "maintenance-jobs"

export const MAINTENANCE_JOBS_QUEUE_NAME =
  process.env.MAINTENANCE_JOBS_QUEUE_NAME ?? DEFAULT_MAINTENANCE_JOBS_QUEUE_NAME

/** Injection token of the list of every registered maintenance job. */
export const MAINTENANCE_JOBS = Symbol("MAINTENANCE_JOBS")
