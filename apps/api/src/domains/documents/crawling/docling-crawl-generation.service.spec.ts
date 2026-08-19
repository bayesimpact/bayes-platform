const multi = { incr: jest.fn(), expire: jest.fn(), exec: jest.fn() }
const client = { multi: jest.fn(() => multi), get: jest.fn(), quit: jest.fn() }

jest.mock("ioredis", () => jest.fn().mockImplementation(() => client))

import { DoclingCrawlGenerationService } from "./docling-crawl-generation.service"

describe("DoclingCrawlGenerationService", () => {
  let service: DoclingCrawlGenerationService

  beforeEach(() => {
    multi.incr.mockReturnValue(multi)
    multi.expire.mockReturnValue(multi)
    service = new DoclingCrawlGenerationService()
  })

  describe("bumpGeneration", () => {
    it("increments the generation counter and refreshes its TTL", async () => {
      multi.exec.mockResolvedValue([
        [null, 3],
        [null, 1],
      ])

      const generation = await service.bumpGeneration("doc-1")

      expect(client.multi).toHaveBeenCalled()
      expect(multi.incr).toHaveBeenCalledWith("docling-crawling:generation:doc-1")
      expect(multi.expire).toHaveBeenCalledWith("docling-crawling:generation:doc-1", 24 * 60 * 60)
      expect(generation).toBe(3)
    })

    it("throws when the INCR command itself errors", async () => {
      const incrError = new Error("redis down")
      multi.exec.mockResolvedValue([[incrError, null]])

      await expect(service.bumpGeneration("doc-1")).rejects.toThrow(incrError)
    })
  })

  describe("isSuperseded", () => {
    it("fails open (not superseded) when no generation has been recorded yet", async () => {
      client.get.mockResolvedValue(null)

      await expect(service.isSuperseded("doc-1", 1)).resolves.toBe(false)
    })

    it("is not superseded when the current generation matches", async () => {
      client.get.mockResolvedValue("2")

      await expect(service.isSuperseded("doc-1", 2)).resolves.toBe(false)
    })

    it("is superseded when a newer generation has been recorded", async () => {
      client.get.mockResolvedValue("3")

      await expect(service.isSuperseded("doc-1", 2)).resolves.toBe(true)
    })
  })
})
