import type { ConnectionOptions } from "bullmq"

/**
 * Redis connection of the BullMQ queues, from BULLMQ_REDIS_URL.
 *
 * redis://[user[:password]@]host[:port]: plain connection (the bundled Redis
 *   of the chart, local Docker).
 * rediss://...: TLS. The server certificate is checked against the system
 *   store, or against BULLMQ_REDIS_TLS_CA (a CA certificate, PEM) when set.
 *   Managed instances (Memorystore with in-transit encryption) sign with a
 *   per-instance CA, which needs the latter. Without TLS the CA is ignored.
 */
export function getBullMqConnection(env: NodeJS.ProcessEnv = process.env): ConnectionOptions {
  const redisUrl = env.BULLMQ_REDIS_URL ?? "redis://localhost:6379"
  const parsedRedisUrl = new URL(redisUrl)
  const ca = env.BULLMQ_REDIS_TLS_CA?.trim()

  return {
    host: parsedRedisUrl.hostname,
    port: Number(parsedRedisUrl.port || "6379"),
    ...(parsedRedisUrl.username && { username: parsedRedisUrl.username }),
    ...(parsedRedisUrl.password && { password: parsedRedisUrl.password }),
    ...(parsedRedisUrl.protocol === "rediss:" && { tls: ca ? { ca } : {} }),
  }
}
