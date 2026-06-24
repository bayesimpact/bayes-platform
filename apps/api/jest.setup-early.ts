/**
 * Runs via Jest `setupFiles` **before** the test framework and before any spec module is loaded.
 * Prevents Bull Board `forFeature` from being registered without `forRoot` when `.env` / shell sets `BULL_BOARD_ENABLED`.
 */
delete process.env.BULL_BOARD_ENABLED

// Worker queue selection fails fast when unset (see worker-pools.ts). Provide
// defaults so specs importing worker constants/modules don't throw at import.
process.env.WORKER_QUEUE_NAMES ??=
  "evaluation-extraction-run-queue,evaluation-extraction-run-execute-queue,agent-csv-extraction-run-queue,agent-csv-extraction-run-execute-queue,extraction-agent-session-queue,url-crawling,document-embeddings,document-embeddings-stuck-sweep,web-source-embeddings"
process.env.WORKERS_HEALTH_QUEUE_NAME ??= "document-embeddings"
