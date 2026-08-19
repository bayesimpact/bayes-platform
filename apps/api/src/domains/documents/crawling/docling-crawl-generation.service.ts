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
  private readonly client = new Redis(getBullMqConnection() as RedisOptions)

  async onModuleDestroy(): Promise<void> {
    await this.client.quit()
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
