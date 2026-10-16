import { createHash, createHmac } from "node:crypto"
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis"
import type { ThrottlerModuleOptions } from "@nestjs/throttler"
import type { RedisOptions } from "ioredis"
import { getBullMqConnection } from "@/bullmq.config"
import { normalizePem } from "@/domains/apps/app-jwt"

/** Named limits of the OAuth endpoints. Each route picks its own and skips the others. */
export const OAUTH_THROTTLERS = {
  ip: "ip",
  global: "global",
  client: "client",
  user: "user",
} as const

const HOUR_MS = 60 * 60 * 1000

/**
 * IPs are hashed before they become Redis keys: the counters work the same,
 * and no address is stored in clear. The key comes from the server's signing
 * key, so no new secret is needed.
 */
function buildIpHasher(): (ip: string) => string {
  const signingKey = process.env.OAUTH_SIGNING_PRIVATE_KEY
  const secret = createHash("sha256")
    .update(signingKey ? normalizePem(signingKey) : "oauth-rate-limit")
    .digest()
  return (ip) => createHmac("sha256", secret).update(ip).digest("hex")
}

export function buildOAuthThrottlerOptions(
  env: NodeJS.ProcessEnv = process.env,
): ThrottlerModuleOptions {
  const hashIp = buildIpHasher()
  return {
    // Shared counters across API replicas. Tests count in memory.
    ...(env.NODE_ENV !== "test" && {
      storage: new ThrottlerStorageRedisService(getBullMqConnection(env) as RedisOptions),
    }),
    throttlers: [
      {
        name: OAUTH_THROTTLERS.ip,
        ttl: HOUR_MS,
        limit: 300,
        getTracker: (request) => hashIp(String(request.ip ?? "unknown")),
      },
      {
        name: OAUTH_THROTTLERS.global,
        ttl: 24 * HOUR_MS,
        limit: 1000,
        getTracker: () => "all",
      },
      {
        name: OAUTH_THROTTLERS.client,
        ttl: 60 * 1000,
        limit: 60,
        getTracker: (request) => String(request.body?.client_id ?? "none"),
      },
      {
        name: OAUTH_THROTTLERS.user,
        ttl: HOUR_MS,
        limit: 120,
        getTracker: (request) => String(request.user?.id ?? request.user?.sub ?? "anonymous"),
      },
    ],
  }
}
