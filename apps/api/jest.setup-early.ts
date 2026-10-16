/**
 * Runs via Jest `setupFiles` **before** the test framework and before any spec module is loaded.
 */
import { generateKeyPairSync } from "node:crypto"

// OAuth and MCP URLs follow the test server's random port, never a local .env value.
delete process.env.API_PUBLIC_URL

// Worker queue selection fails fast when unset (see worker-pools.ts). `all`
// enables every known queue, so this file never carries a copy of the list.
process.env.WORKER_QUEUE_NAMES ??= "all"
process.env.WORKERS_HEALTH_QUEUE_NAME ??= "document-embeddings"
// Required by every worker process (no default in code), see pdf-exports.constants.ts.
process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME ??= "pdf-exports-sweep"

if (!process.env.OAUTH_SIGNING_PRIVATE_KEY || !process.env.OAUTH_SIGNING_PUBLIC_KEY) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })
  process.env.OAUTH_SIGNING_PRIVATE_KEY = privateKey
  process.env.OAUTH_SIGNING_PUBLIC_KEY = publicKey
}
process.env.APPS_JWT_ISSUER ??= "https://api.bayes.io/apps"
process.env.APPS_JWT_AUDIENCE ??= "bayes-apps"
