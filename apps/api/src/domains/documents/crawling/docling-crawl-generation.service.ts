import { Injectable, type OnModuleDestroy } from "@nestjs/common"
import Redis, { type RedisOptions } from "ioredis"
import { getBullMqConnection } from "@/bullmq.config"

// Safety net against unbounded key growth — far longer than any crawl duration or worker
// lock duration, so it never expires while a crawl is legitimately still in flight.
const GENERATION_KEY_TTL_SECONDS = 24 * 60 * 60

function generationKey(documentId: string): string {
  return `docling-crawling:generation:${documentId}`
}

@Injectable()
export class DoclingCrawlGenerationService implements OnModuleDestroy {
  // lazyConnect: most Nest module graphs that pull this service in (any domain that
  // transitively imports DocumentsModule) never actually call bumpGeneration/isSuperseded,
  // so don't open a real Redis connection until one of those is actually invoked.
  private readonly client = new Redis({
    ...(getBullMqConnection() as RedisOptions),
    lazyConnect: true,
  })

  onModuleDestroy(): void {
    // disconnect() (not quit()) — synchronous, never sends a command over the wire, and is
    // safe to call regardless of connection state. quit() throws if the connection never
    // established (e.g. Redis unreachable at shutdown time), which would crash teardown.
    this.client.disconnect()
  }

  async bumpGeneration(documentId: string): Promise<number> {
    const key = generationKey(documentId)
    const results = await this.client
      .multi()
      .incr(key)
      .expire(key, GENERATION_KEY_TTL_SECONDS)
      .exec()

    const incrResult = results?.[0]
    if (!incrResult || incrResult[0]) {
      throw (
        incrResult?.[0] ?? new Error(`Failed to bump crawl generation for document ${documentId}`)
      )
    }
    return incrResult[1] as number
  }

  async isSuperseded(documentId: string, generation: number): Promise<boolean> {
    const current = await this.client.get(generationKey(documentId))
    if (current === null) {
      return false
    }
    return Number(current) > generation
  }
}
