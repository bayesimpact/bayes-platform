import { AgentModel } from "@caseai-connect/api-contracts"
import { z } from "zod"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { AgentsModule } from "@/domains/agents/agents.module"
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { EXTRACTION_AGENT_SESSION_BATCH_SERVICE } from "./extraction-agent-session-batch.interface"
import { ExtractionAgentSessionsService } from "./extraction-agent-sessions.service"

/** A batch service whose queue interactions are stubbed out (no Redis/BullMQ). */
const buildMockBatchService = () => ({
  enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
})

describe("ExtractionAgentSessionsService", () => {
  let service: ExtractionAgentSessionsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  const mockBatchService = buildMockBatchService()

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) =>
        moduleBuilder
          .overrideProvider(EXTRACTION_AGENT_SESSION_BATCH_SERVICE)
          .useValue(mockBatchService),
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(ExtractionAgentSessionsService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await sdk.shutdown()
    await teardownE2eTestDatabase(setup)
  })

  it("creates a pending run and enqueues an execute job", async () => {
    const schema = z.object({ content: z.string(), source: z.string() })
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: {
          type: "extraction",
        },
        agentSettings: {
          model: AgentModel._MockGenerateStructuredOutput,
          outputJsonSchema: schema.toJSONSchema(),
        },
      },
    )

    const document = documentFactory.transient({ organization, project }).build({
      mimeType: "application/pdf",
      sourceType: "extraction",
      storageRelativePath: "test/file.pdf",
    })
    await repositories.documentRepository.save(document)

    const run = await service.executeExtraction({
      connectScope: { organizationId: organization.id, projectId: project.id },
      agent,
      agentSettings,
      userId: user.id,
      documentId: document.id,
      type: "playground",
    })

    expect(run.status).toBe("pending")
    expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledTimes(1)
    expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledWith({
      extractionAgentSessionId: run.id,
      organizationId: organization.id,
      projectId: project.id,
    })
  })

  it("should list and retrieve runs scoped by agent", async () => {
    const schema = z.object({ content: z.string(), source: z.string() })
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: {
          type: "extraction",
        },
        agentSettings: {
          model: AgentModel._MockGenerateStructuredOutput,
          outputJsonSchema: schema.toJSONSchema(),
        },
      },
    )
    const document = documentFactory.transient({ organization, project }).build({
      mimeType: "application/pdf",
      sourceType: "extraction",
      storageRelativePath: "test/file.pdf",
    })
    await repositories.documentRepository.save(document)

    const createdRun = await service.executeExtraction({
      connectScope: { organizationId: organization.id, projectId: project.id },
      agent,
      agentSettings,
      userId: user.id,
      documentId: document.id,
      type: "playground",
    })

    const runs = await service.listRuns({
      connectScope: { organizationId: organization.id, projectId: project.id },
      agentId: agent.id,
      type: "playground",
      userId: user.id,
    })
    expect(runs).toHaveLength(1)
    expect(runs[0]!.id).toBe(createdRun.id)

    const run = await service.findAgentSessionById({
      connectScope: { organizationId: organization.id, projectId: project.id },
      agentSessionId: createdRun.id,
      type: "playground",
    })
    expect(run).not.toBeNull()
    expect(run!.id).toBe(createdRun.id)
  })
})
