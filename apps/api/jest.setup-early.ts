/**
 * Runs via Jest `setupFiles` **before** the test framework and before any spec module is loaded.
 * Prevents Bull Board `forFeature` from being registered without `forRoot` when `.env` / shell sets `BULL_BOARD_ENABLED`.
 */
import { generateKeyPairSync } from "node:crypto"

delete process.env.BULL_BOARD_ENABLED

// Worker queue selection fails fast when unset (see worker-pools.ts). `all`
// enables every known queue, so this file never carries a copy of the list.
process.env.WORKER_QUEUE_NAMES ??= "all"
process.env.WORKERS_HEALTH_QUEUE_NAME ??= "document-embeddings"
// Required by every worker process (no default in code), see pdf-exports.constants.ts.
process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME ??= "pdf-exports-sweep"

if (!process.env.APPS_JWT_PRIVATE_KEY || !process.env.APPS_JWT_PUBLIC_KEY) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })
  process.env.APPS_JWT_PRIVATE_KEY = privateKey
  process.env.APPS_JWT_PUBLIC_KEY = publicKey
}
process.env.APPS_JWT_ISSUER ??= "https://api.bayes.io/apps"
process.env.APPS_JWT_AUDIENCE ??= "bayes-apps"
