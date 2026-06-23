import { AgentModel } from "@caseai-connect/api-contracts"
import { UnprocessableEntityException } from "@nestjs/common"
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
import { ExtractionAgentSessionsService } from "./extraction-agent-sessions.service"

describe("ExtractionAgentSessionsService", () => {
  let service: ExtractionAgentSessionsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      //   applyOverrides: (moduleBuilder) =>
      //     moduleBuilder.overrideProvider("LLMProvider").useValue(mockLlmProvider),
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

  // executeExtraction is fire-and-forget: it returns immediately with a
  // "pending" run while the LLM call resolves in the background. Poll the DB
  // until the run reaches a terminal status.
  const waitForRunCompletion = async (runId: string) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const run = await repositories.extractionAgentSessionRepository.findOneBy({ id: runId })
      if (run && run.status !== "pending") return run
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error(`Extraction run ${runId} did not complete in time`)
  }

  it("should execute extraction and persist a successful run", async () => {
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

    const pendingRun = await service.executeExtraction({
      connectScope: { organizationId: organization.id, projectId: project.id },
      agent,
      userId: user.id,
      documentId: document.id,
      type: "playground",
    })
    expect(pendingRun.status).toBe("pending")

    const run = await waitForRunCompletion(pendingRun.id)

    expect(run.status).toBe("success")
    const result = run.result
    expect(result).toBeDefined()
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expect(parsed.source).toBe("MOCK") //see <default mock result for generateObject>
    expect(parsed.content).toBe("Hello, I'm the generateStructuredOutput default mock response!") //see <default mock result for generateObject>
  })

  //fixme: schema validation in a separate function
  xit("should persist failed run when schema validation fails", async () => {
    const schema = z.object({ fullname: z.string() })
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

    const schemaError = new Error("schema mismatch")
    schemaError.name = "TypeValidationError"

    await expect(
      service.executeExtraction({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agent,
        userId: user.id,
        documentId: document.id,
        type: "playground",
      }),
    ).rejects.toThrow(UnprocessableEntityException)

    const runs = await repositories.extractionAgentSessionRepository.find()
    expect(runs).toHaveLength(1)
    expect(runs[0]!.status).toBe("failed")
    expect(runs[0]!.errorCode).toBe("SCHEMA_VALIDATION_FAILED")
  })

  it("should list and retrieve runs scoped by agent", async () => {
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

    const createdRun = await service.executeExtraction({
      connectScope: { organizationId: organization.id, projectId: project.id },
      agent,
      userId: user.id,
      documentId: document.id,
      type: "playground",
    })
    await waitForRunCompletion(createdRun.id)

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
      agentId: agent.id,
      type: "playground",
    })
    expect(run).not.toBeNull()
    const result = run?.result
    expect(result).toBeDefined()
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expect(parsed.source).toBe("MOCK") //see <default mock result for generateObject>
    expect(parsed.content).toBe("Hello, I'm the generateStructuredOutput default mock response!") //see <default mock result for generateObject>
  })
})
