const DEFAULT_SWEEP_CRON_PATTERN = "0 4 * * *" // daily at 04:00

/**
 * Cron pattern anchoring the retention sweep to wall-clock time
 * (CONVERSATION_RETENTION_SWEEP_CRON, default: daily at 04:00). The sweep
 * drains all expired sessions in batches on each run, so a daily anchor is
 * enough regardless of volume.
 */
export function getConversationRetentionSweepCronPattern(): string {
  const rawValue = process.env.CONVERSATION_RETENTION_SWEEP_CRON
  return rawValue === undefined || rawValue === "" ? DEFAULT_SWEEP_CRON_PATTERN : rawValue
}
