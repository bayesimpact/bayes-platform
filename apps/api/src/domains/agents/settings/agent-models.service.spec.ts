import { AgentModel } from "@caseai-connect/api-contracts"
import { Test } from "@nestjs/testing"
import { LlmModule } from "@/external/llm/llm.module"
import { AgentModelsService } from "./agent-models.service"

describe("AgentModelsService", () => {
  let service: AgentModelsService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LlmModule],
      providers: [AgentModelsService],
    }).compile()
    service = module.get(AgentModelsService)
  })

  describe("isModelRetired", () => {
    const deprecation = {
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35Flash,
    }

    it("keeps a model without deprecation", () => {
      expect(service.isModelRetired(undefined, new Date("2030-01-01T00:00:00Z"))).toBe(false)
    })

    it("keeps a model through its whole deprecation day, in UTC", () => {
      expect(service.isModelRetired(deprecation, new Date("2026-09-30T23:59:59Z"))).toBe(false)
    })

    it("retires a model from the day after its deprecation date, in UTC", () => {
      expect(service.isModelRetired(deprecation, new Date("2026-10-01T00:00:00Z"))).toBe(true)
    })
  })
})
