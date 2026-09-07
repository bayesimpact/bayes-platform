/**
 * Runs via Jest `setupFiles` **before** the test framework and before any spec module is loaded.
 * Prevents Bull Board `forFeature` from being registered without `forRoot` when `.env` / shell sets `BULL_BOARD_ENABLED`.
 */
delete process.env.BULL_BOARD_ENABLED

// Worker queue selection fails fast when unset (see worker-pools.ts). `all`
// enables every known queue, so this file never carries a copy of the list.
process.env.WORKER_QUEUE_NAMES ??= "all"
process.env.WORKERS_HEALTH_QUEUE_NAME ??= "document-embeddings"
