import { randomUUID } from "node:crypto"
import { AgentModel } from "@caseai-connect/api-contracts"
import { EvalConversationRunsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createRunWithConversationDataset } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
import { EVALUATION_CONVERSATION_RUN_BATCH_SERVICE } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run-batch.interface"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

type RouteName = keyof typeof EvalConversationRunsRoutes

/** The status of an allowed call. */
const ROUTE_STATUSES: Record<RouteName, number> = {
  getAll: 200,
  getOne: 200,
  getRecords: 200,
  createOne: 201,
  executeOne: 201,
  retryOne: 201,
  cancelOne: 201,
  deleteOne: 200,
}

const ROUTE_NAMES = Object.keys(ROUTE_STATUSES) as RouteName[]

/** The routes that load the run of their path (`@AddContext("evaluationConversationRun")` today). */
const RUN_ROUTE_NAMES: RouteName[] = [
  "getOne",
  "getRecords",
  "executeOne",
  "retryOne",
  "cancelOne",
  "deleteOne",
]

describe("Evaluation conversation runs - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let evaluationConversationRunId: string = randomUUID()
  let datasetId: string = randomUUID()
  let agentId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
            removePendingExecuteRun: jest.fn().mockResolvedValue(undefined),
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: jest.fn().mockResolvedValue(undefined),
            removePendingRunRecords: jest.fn().mockResolvedValue(undefined),
          }),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    evaluationConversationRunId = randomUUID()
    datasetId = randomUUID()
    agentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A conversation agent with a dataset and a pending run, and a caller with the given roles. */
  const createContextForRoles = async (...roleKeys: ProjectRoleKey[]) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
        projectMembership: { roleKeys },
        agent: { type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
      },
    )
    const { dataset, run } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    organizationId = organization.id
    projectId = project.id
    evaluationConversationRunId = run.id
    datasetId = dataset.id
    agentId = agent.id
    return { organization, project, agent, agentSettings }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRoles>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
  }

  const runParams = () => ({ organizationId, projectId, evaluationConversationRunId })

  const subjects: Record<RouteName, () => ReturnType<SchemaRequester>> = {
    getAll: () =>
      request({
        route: EvalConversationRunsRoutes.getAll,
        pathParams: { organizationId, projectId },
        token: accessToken,
      }),
    getOne: () =>
      request({
        route: EvalConversationRunsRoutes.getOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    getRecords: () =>
      request({
        route: EvalConversationRunsRoutes.getRecords,
        pathParams: runParams(),
        query: { page: "0", limit: "100" },
        token: accessToken,
      }),
    createOne: () =>
      request({
        route: EvalConversationRunsRoutes.createOne,
        pathParams: { organizationId, projectId },
        body: {
          payload: {
            agentId,
            agentSettingsRevision: null,
            datasetId,
            judgeModel: AgentModel.Gemini35Flash,
            judgeInstructions: null,
          },
        },
        token: accessToken,
      }),
    executeOne: () =>
      request({
        route: EvalConversationRunsRoutes.executeOne,
        pathParams: runParams(),
        body: { payload: { recordLimit: null } },
        token: accessToken,
      }),
    retryOne: () =>
      request({
        route: EvalConversationRunsRoutes.retryOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    cancelOne: () =>
      request({
        route: EvalConversationRunsRoutes.cancelOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    deleteOne: () =>
      request({
        route: EvalConversationRunsRoutes.deleteOne,
        pathParams: runParams(),
        token: accessToken,
      }),
  }

  // `evaluation.conversation.run.*` on the project, as `EvaluationConversationRunsController`
  // checks: only an evaluator of the project holds them.
  describe.each(ROUTE_NAMES)("EvalConversationRunsRoutes.%s", (routeName) => {
    const subject = () => subjects[routeName]()

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an organization id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      organizationId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 400 for a project id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      projectId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("requires an existing project of the organization", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("doesn't let a project member in", async () => {
      await createContextForRoles("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let a project admin who is not an evaluator in", async () => {
      await createContextForRoles("project_admin")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let an organization admin outside the project in", async () => {
      const context = await createContextForRoles("project_owner", "project_evaluator")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("lets a project member who is an evaluator in", async () => {
      await createContextForRoles("project_member", "project_evaluator")
      expectResponse(await subject(), ROUTE_STATUSES[routeName])
    })
  })

  describe.each(RUN_ROUTE_NAMES)("EvalConversationRunsRoutes.%s, its run", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a run id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      evaluationConversationRunId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown run", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      evaluationConversationRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a run of another project", async () => {
      const { organization, agent, agentSettings } = await createContextForRoles(
        "project_owner",
        "project_evaluator",
      )
      const otherProject = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      const { run } = await createRunWithConversationDataset({
        getRepository: setup.getRepository,
        organization,
        project: otherProject,
        agent,
        agentSettings,
      })
      evaluationConversationRunId = run.id
      expectResponse(await subject(), 404)
    })
  })
})
