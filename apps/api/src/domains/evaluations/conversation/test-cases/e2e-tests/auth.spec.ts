import { randomUUID } from "node:crypto"
import { EvaluationConversationTestCasesRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { createConversationWithAnswers } from "./test-case.helpers"

describe("EvaluationConversationTestCases - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let mockProvider: AISDKMockProvider

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentMessageId: string = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    mockProvider = setup.module.get(AISDKMockProvider)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockProvider.resetMock()
    organizationId = randomUUID()
    projectId = randomUUID()
    agentMessageId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectMembershipRole) => {
    const { user, organization, project, lastAnswer } = await createConversationWithAnswers(
      repositories,
      {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
        projectMembership: { role },
      },
    )
    organizationId = organization.id
    projectId = project.id
    agentMessageId = lastAnswer.id
    authSubject = user.authSubject!
  }

  const routes = {
    createOne: () =>
      request({
        route: EvaluationConversationTestCasesRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: {
          payload: {
            datasetId: null,
            newDatasetName: "Billing questions",
            input: "Can I switch to the monthly plan?",
            expectedOutput: "Yes, from Settings › Billing.",
            comment: null,
          },
        },
      }),
    draftInput: () =>
      request({
        route: EvaluationConversationTestCasesRoutes.draftInput,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: { payload: { agentMessageId, inputMode: "lastMessage" } },
      }),
    draftExpectedOutput: () =>
      request({
        route: EvaluationConversationTestCasesRoutes.draftExpectedOutput,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: { payload: { agentMessageId, comment: "A plan switch gives store credit." } },
      }),
    anonymize: () =>
      request({
        route: EvaluationConversationTestCasesRoutes.anonymize,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: { payload: { agentMessageId, text: "I am Jordan Lee." } },
      }),
  }

  describe.each(
    Object.entries(routes),
  )("EvaluationConversationTestCasesRoutes.%s", (_, subject) => {
    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each<ProjectMembershipRole>(["admin", "owner"])("allows a project %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })
  })
})
