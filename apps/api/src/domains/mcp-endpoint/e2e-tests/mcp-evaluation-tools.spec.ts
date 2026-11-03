import {
  AgentModel,
  EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH,
  type OAuthGrantablePermission,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { EvaluationConversationDataset } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.entity"
import { EvaluationConversationDatasetRecord } from "@/domains/evaluations/conversation/datasets/records/evaluation-conversation-dataset-record.entity"
import { createDatasetWithRecords } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
import { EvaluationConversationRun } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run.entity"
import { EVALUATION_CONVERSATION_RUN_BATCH_SERVICE } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run-batch.interface"
import { obtainTokens, resetRateLimits } from "@/domains/oauth/e2e-tests/oauth-test.helpers"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { listenOnLoopback, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { AGENT_NOT_READABLE_ERROR } from "../mcp-agent-tools.service"
import { McpEndpointModule } from "../mcp-endpoint.module"
import {
  DATASET_NOT_FOUND_ERROR,
  EVALUATED_AGENT_NOT_FOUND_ERROR,
  EVALUATION_PROJECT_NOT_FOUND_ERROR,
  RUN_NOT_FOUND_ERROR,
} from "../mcp-evaluation-tools.service"

const ALL_PERMISSIONS: OAuthGrantablePermission[] = [
  "project.read",
  "agent.create",
  "agent.settings.draft.update",
  "evaluation.conversation.dataset.update",
  "evaluation.conversation.run.create",
]

const RECORDS = [
  {
    input: "How do I reset my password?",
    expectedOutput: "From the sign-in page, Forgot password.",
  },
  { input: "Can I change my plan?", expectedOutput: "Yes, from the Billing settings." },
]

describe("MCP endpoint - evaluation tools", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let baseUrl: string
  let endpointUrl: URL
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>
  const mockEnqueueExecuteRun = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [McpEndpointModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: mockEnqueueExecuteRun,
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
          }),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    configureGlobalPrefix(app)
    baseUrl = await listenOnLoopback(app)
    endpointUrl = new URL(`${baseUrl}/api/mcp`)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    resetRateLimits(app)
    mockEnqueueExecuteRun.mockClear()
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      organizationMembership: { roleKeys: ["org_owner"] },
      projectMembership: { roleKeys: ["project_owner", "project_evaluator"] },
    })
    authSubject = user.authSubject!
    return { user, organization, project }
  }

  const connect = async (
    projectIds: string[],
    permissions: OAuthGrantablePermission[] = ALL_PERMISSIONS,
  ) => {
    const { accessToken } = await obtainTokens(baseUrl, { projectIds, permissions })
    const client = new Client({ name: "e2e-test-client", version: "1.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(endpointUrl, {
        requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
      }),
    )
    return client
  }

  const call = async (client: Client, name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args })
    return {
      isError: result.isError === true,
      // biome-ignore lint/suspicious/noExplicitAny: tool outputs are read field by field in each test
      output: result.structuredContent as any,
      text: (result.content as Array<{ text?: string }>)[0]?.text,
    }
  }

  /** An agent created and published through the tools, then changed into a draft (revision 2). */
  const createAgentWithDraft = async (client: Client, projectId: string) => {
    const created = await call(client, "create_agent", {
      projectId,
      name: "Helpful Assistant",
      instructions: "Answer questions about the product.",
      model: AgentModel.Gemini35FlashLite,
    })
    const agentId: string = created.output.agent.id
    await call(client, "update_agent", {
      agentId,
      instructions: "Answer questions about the product, in two sentences at most.",
    })
    return agentId
  }

  describe("get_agent", () => {
    it("returns the published version, the draft and the versions", async () => {
      const { project } = await createContext()
      const client = await connect([project.id])
      const agentId = await createAgentWithDraft(client, project.id)

      const { isError, output } = await call(client, "get_agent", { agentId })

      expect(isError).toBe(false)
      expect(output.agent).toMatchObject({
        id: agentId,
        name: "Helpful Assistant",
        published: true,
        canUpdate: true,
        publishedVersion: {
          revision: 1,
          instructions: "Answer questions about the product.",
          greetingMessage: null,
        },
        draft: {
          revision: 2,
          instructions: "Answer questions about the product, in two sentences at most.",
        },
        revisions: [
          { revision: 2, isDraft: true },
          { revision: 1, isDraft: false },
        ],
      })
      await client.close()
    })

    it("hides the draft from an agent member", async () => {
      const { user, agent } = await createOrganizationWithAgent(repositories, {
        organizationMembership: { roleKeys: ["org_member"] },
        projectMembership: { roleKeys: ["project_member"] },
        agentMembership: { roleKeys: ["agent_member"] },
      })
      authSubject = user.authSubject!
      const client = await connect([agent.projectId])

      const { output } = await call(client, "get_agent", { agentId: agent.id })

      expect(output.agent).toMatchObject({ id: agent.id, draft: null, canUpdate: false })
      expect(
        output.agent.revisions.every((revision: { isDraft: boolean }) => !revision.isDraft),
      ).toBe(true)
      await client.close()
    })

    it("refuses an agent of a project outside the grant", async () => {
      const { project } = await createContext()
      const { agent } = await createOrganizationWithAgent(repositories)
      const client = await connect([project.id])

      const { isError, text } = await call(client, "get_agent", { agentId: agent.id })

      expect(isError).toBe(true)
      expect(text).toBe(AGENT_NOT_READABLE_ERROR)
      await client.close()
    })
  })

  describe("datasets", () => {
    it("creates a dataset, fills it and reads it back", async () => {
      const { project, user } = await createContext()
      const client = await connect([project.id])

      const created = await call(client, "create_evaluation_dataset", {
        projectId: project.id,
        name: "Support questions",
      })
      const datasetId: string = created.output.dataset.id
      const filled = await call(client, "add_dataset_records", {
        projectId: project.id,
        datasetId,
        records: RECORDS,
      })
      const listed = await call(client, "list_evaluation_datasets", { projectId: project.id })
      const read = await call(client, "list_dataset_records", {
        projectId: project.id,
        datasetId,
      })

      expect(created.output.dataset).toMatchObject({ name: "Support questions", recordCount: 0 })
      expect(filled.output.dataset).toMatchObject({ id: datasetId, recordCount: 2 })
      expect(listed.output.datasets).toEqual([
        expect.objectContaining({ id: datasetId, recordCount: 2 }),
      ])
      expect(read.output).toMatchObject({ total: 2, page: 0, limit: 50 })
      // Records added together share their creation date, so their order is not part of the contract.
      expect(read.output.items).toEqual(
        expect.arrayContaining(RECORDS.map((record) => expect.objectContaining(record))),
      )
      await expectActivityCreated("evaluationConversationDataset.create", {
        userId: user.id,
        projectId: project.id,
      })
      await expectActivityCreated("evaluationConversationDataset.createRecords", {
        userId: user.id,
        projectId: project.id,
      })
      await client.close()
    })

    it("refuses a record longer than the maximum", async () => {
      const { project } = await createContext()
      const client = await connect([project.id])
      const created = await call(client, "create_evaluation_dataset", {
        projectId: project.id,
        name: "Support questions",
      })

      const { isError } = await call(client, "add_dataset_records", {
        projectId: project.id,
        datasetId: created.output.dataset.id,
        records: [
          {
            input: "a".repeat(EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH + 1),
            expectedOutput: "Answer",
          },
        ],
      })

      expect(isError).toBe(true)
      expect(await setup.getRepository(EvaluationConversationDatasetRecord).count()).toBe(0)
      await client.close()
    })

    it("refuses without the dataset grant", async () => {
      const { project } = await createContext()
      const client = await connect(
        [project.id],
        ["project.read", "evaluation.conversation.run.create"],
      )

      const { isError, text } = await call(client, "create_evaluation_dataset", {
        projectId: project.id,
        name: "Support questions",
      })

      expect(isError).toBe(true)
      expect(text).toBe(EVALUATION_PROJECT_NOT_FOUND_ERROR)
      expect(await setup.getRepository(EvaluationConversationDataset).count()).toBe(0)
      await client.close()
    })

    it("refuses a project member, who cannot create datasets, even with the grant", async () => {
      const { user, project } = await createOrganizationWithProject(repositories, {
        organizationMembership: { roleKeys: ["org_member"] },
        projectMembership: { roleKeys: ["project_member"] },
      })
      authSubject = user.authSubject!
      const client = await connect([project.id])

      const { isError, text } = await call(client, "create_evaluation_dataset", {
        projectId: project.id,
        name: "Support questions",
      })

      expect(isError).toBe(true)
      expect(text).toBe(EVALUATION_PROJECT_NOT_FOUND_ERROR)
      await client.close()
    })

    it("refuses a project owner who is not an evaluator, even with the grant", async () => {
      const { user, project } = await createOrganizationWithProject(repositories)
      authSubject = user.authSubject!
      const client = await connect([project.id])

      const { isError, text } = await call(client, "create_evaluation_dataset", {
        projectId: project.id,
        name: "Support questions",
      })

      expect(isError).toBe(true)
      expect(text).toBe(EVALUATION_PROJECT_NOT_FOUND_ERROR)
      await client.close()
    })

    it("answers a dataset of another project as not found", async () => {
      const { project } = await createContext()
      const other = await createOrganizationWithProject(repositories)
      const { dataset } = await createDatasetWithRecords({
        getRepository: setup.getRepository.bind(setup),
        organization: other.organization,
        project: other.project,
      })
      const client = await connect([project.id])

      const { isError, text } = await call(client, "add_dataset_records", {
        projectId: project.id,
        datasetId: dataset.id,
        records: RECORDS,
      })

      expect(isError).toBe(true)
      expect(text).toBe(DATASET_NOT_FOUND_ERROR)
      await client.close()
    })
  })

  describe("runs", () => {
    const createDataset = async (client: Client, projectId: string) => {
      const created = await call(client, "create_evaluation_dataset", {
        projectId,
        name: "Support questions",
      })
      const datasetId: string = created.output.dataset.id
      await call(client, "add_dataset_records", { projectId, datasetId, records: RECORDS })
      return datasetId
    }

    it("evaluates the draft without publishing it, then reads the run back", async () => {
      const { project, user } = await createContext()
      const client = await connect([project.id])
      const agentId = await createAgentWithDraft(client, project.id)
      const datasetId = await createDataset(client, project.id)

      const started = await call(client, "run_evaluation", {
        projectId: project.id,
        agentId,
        datasetId,
        agentRevision: "draft",
        judgeInstructions: "Penalize answers longer than two sentences.",
      })
      const runId: string = started.output.run.id
      const fetched = await call(client, "get_evaluation_run", { projectId: project.id, runId })
      const listed = await call(client, "list_evaluation_runs", { projectId: project.id, agentId })
      const records = await call(client, "list_evaluation_run_records", {
        projectId: project.id,
        runId,
      })
      const agent = await call(client, "get_agent", { agentId })

      expect(started.isError).toBe(false)
      expect(started.output.run).toMatchObject({
        status: "pending",
        agentId,
        agentRevision: 2,
        agentRevisionIsDraft: true,
        datasetId,
        judgeModel: AgentModel.Gemini35FlashLite,
        judgeInstructions: "Penalize answers longer than two sentences.",
      })
      expect(mockEnqueueExecuteRun).toHaveBeenCalledWith(
        expect.objectContaining({ evaluationConversationRunId: runId, recordLimit: null }),
      )
      expect(fetched.output.run).toMatchObject({ id: runId, agentRevision: 2 })
      expect(listed.output).toMatchObject({ items: [{ id: runId }], total: 1, page: 0, limit: 50 })
      expect(records.output).toMatchObject({ items: [], total: 0 })
      expect(agent.output.agent).toMatchObject({
        publishedVersion: { revision: 1 },
        draft: { revision: 2 },
      })
      await expectActivityCreated("evaluationConversationRun.create", {
        userId: user.id,
        projectId: project.id,
      })
      await expectActivityCreated("evaluationConversationRun.execute", {
        userId: user.id,
        projectId: project.id,
      })
      await client.close()
    })

    it("lists the runs of one agent page by page, newest first", async () => {
      const { project } = await createContext()
      const client = await connect([project.id])
      const agentId = await createAgentWithDraft(client, project.id)
      const otherAgentId = await createAgentWithDraft(client, project.id)
      const datasetId = await createDataset(client, project.id)
      const run = async (evaluatedAgentId: string) =>
        (
          await call(client, "run_evaluation", {
            projectId: project.id,
            agentId: evaluatedAgentId,
            datasetId,
          })
        ).output.run.id as string
      const oldestRunId = await run(agentId)
      await run(otherAgentId)
      const newestRunId = await run(agentId)

      const first = await call(client, "list_evaluation_runs", {
        projectId: project.id,
        agentId,
        limit: 1,
      })
      const second = await call(client, "list_evaluation_runs", {
        projectId: project.id,
        agentId,
        page: 1,
        limit: 1,
      })

      expect(first.output).toMatchObject({ items: [{ id: newestRunId }], total: 2, page: 0 })
      expect(second.output).toMatchObject({ items: [{ id: oldestRunId }], total: 2, page: 1 })
      await client.close()
    })

    it("evaluates the latest published version by default", async () => {
      const { project } = await createContext()
      const client = await connect([project.id])
      const agentId = await createAgentWithDraft(client, project.id)
      const datasetId = await createDataset(client, project.id)

      const { output } = await call(client, "run_evaluation", {
        projectId: project.id,
        agentId,
        datasetId,
      })

      expect(output.run).toMatchObject({ agentRevision: 1, agentRevisionIsDraft: false })
      await client.close()
    })

    it.each([
      { case: "the draft of an agent that has none", agentRevision: "draft" as const },
      { case: "a version that does not exist", agentRevision: 7 },
    ])("answers $case as not found", async ({ agentRevision }) => {
      const { project } = await createContext()
      const client = await connect([project.id])
      const created = await call(client, "create_agent", {
        projectId: project.id,
        name: "Helpful Assistant",
        instructions: "Answer questions about the product.",
      })
      const datasetId = await createDataset(client, project.id)

      const { isError, text } = await call(client, "run_evaluation", {
        projectId: project.id,
        agentId: created.output.agent.id,
        datasetId,
        agentRevision,
      })

      expect(isError).toBe(true)
      expect(text).toBe(EVALUATED_AGENT_NOT_FOUND_ERROR)
      expect(await setup.getRepository(EvaluationConversationRun).count()).toBe(0)
      await client.close()
    })

    it("refuses without the run grant", async () => {
      const { project } = await createContext()
      const client = await connect(
        [project.id],
        [
          "project.read",
          "agent.create",
          "agent.settings.draft.update",
          "evaluation.conversation.dataset.update",
        ],
      )
      const agentId = await createAgentWithDraft(client, project.id)
      const datasetId = await createDataset(client, project.id)

      const { isError, text } = await call(client, "run_evaluation", {
        projectId: project.id,
        agentId,
        datasetId,
      })

      expect(isError).toBe(true)
      expect(text).toBe(EVALUATION_PROJECT_NOT_FOUND_ERROR)
      expect(mockEnqueueExecuteRun).not.toHaveBeenCalled()
      await client.close()
    })

    it("answers a run of another project as not found", async () => {
      const { project } = await createContext()
      const client = await connect([project.id])

      const { isError, text } = await call(client, "get_evaluation_run", {
        projectId: project.id,
        runId: "6b0c6f3e-6a2d-4f4b-9c55-2f7a2a8f1d10",
      })

      expect(isError).toBe(true)
      expect(text).toBe(RUN_NOT_FOUND_ERROR)
      await client.close()
    })
  })
})
