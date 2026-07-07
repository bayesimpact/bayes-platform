import { AgentModel } from "@caseai-connect/api-contracts"
import { z } from "zod"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { documentFactory } from "@/domains/documents/document.factory"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { LlmModule } from "@/external/llm/llm.module"
import { sdk } from "@/external/llm/open-telemetry-init"
import { extractionAgentSessionFactory } from "./extraction-agent-session.factory"
import { ExtractionAgentSessionRunnerService } from "./extraction-agent-session-runner.service"
import { ExtractionAgentSessionStatusNotifierService } from "./extraction-agent-session-status-notifier.service"

describe("ExtractionAgentSessionRunnerService", () => {
  let runner: ExtractionAgentSessionRunnerService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule, StorageModule],
      providers: [ExtractionAgentSessionRunnerService, ExtractionAgentSessionStatusNotifierService],
    })
    repositories = setup.getAllRepositories()
    runner = setup.module.get(ExtractionAgentSessionRunnerService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await sdk.shutdown()
    await teardownE2eTestDatabase(setup)
  })

  it("runs the extraction and persists a successful run", async () => {
    const schema = z.object({ content: z.string(), source: z.string() })
    const { organization, project, user, agent } = await createOrganizationWithAgent(repositories, {
      agent: {
        model: AgentModel._MockGenerateStructuredOutput,
        type: "extraction",
        outputJsonSchema: schema.toJSONSchema(),
      },
    })

    const document = documentFactory.transient({ organization, project }).build({
      mimeType: "application/pdf",
      sourceType: "extraction",
      storageRelativePath: "test/file.pdf",
    })
    await repositories.documentRepository.save(document)

    const pendingRun = extractionAgentSessionFactory
      .transient({ organization, project, agent, user, document })
      .build({
        status: "pending",
        type: "playground",
        result: null,
        effectivePrompt: agent.defaultPrompt ?? "Extract the document",
        schemaSnapshot: agent.outputJsonSchema ?? {},
      })
    await repositories.extractionAgentSessionRepository.save(pendingRun)

    await runner.runById({
      extractionAgentSessionId: pendingRun.id,
      organizationId: organization.id,
      projectId: project.id,
    })

    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
      id: pendingRun.id,
    })
    expect(run.status).toBe("success")
    const parsed = schema.parse(run.result)
    expect(parsed.source).toBe("MOCK") // see <default mock result for generateObject>
    expect(parsed.content).toBe("Hello, I'm the generateStructuredOutput default mock response!")
  })
})
