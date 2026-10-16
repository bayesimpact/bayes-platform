/** Proposals waiting for the user's approval, per agent and user. */
export const AGENT_MEMORY_MAX_PENDING_PER_USER = 10

/** A saved fact nobody touched for this long is deleted by the nightly sweep. */
export const AGENT_MEMORY_SAVED_RETENTION_DAYS = 180

/** A proposal the user never answered is dropped after this long. */
export const AGENT_MEMORY_PENDING_RETENTION_DAYS = 7
