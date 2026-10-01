import { randomUUID } from "node:crypto"
import { EvaluationExtractionRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationExtractionDataset } from "../../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionRun } from "../evaluation-extraction-run.entity"
import { evaluationExtractionRunFactory } from "../evaluation-extraction-run.factory"

describe("EvaluationExtractionRuns - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let evaluationExtractionRunId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    evaluationExtractionRunId = randomUUID()
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectMembershipRole = "owner") => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        projectMembership: { role },
        agent: { type: "extraction" },
        agentSettings: { outputJsonSchema: { type: "object" } },
      },
    )
    organizationId = organization.id
    projectId = project.id
    accessToken = "token"
    authSubject = user.authSubject!

    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ schemaMapping: {} })
    await setup.getRepository(EvaluationExtractionDataset).save(dataset)

    const run = evaluationExtractionRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationExtractionDataset: dataset,
      })
      .build()
    await setup.getRepository(EvaluationExtractionRun).save(run)
    evaluationExtractionRunId = run.id

    return { organization, project, agent, dataset, run }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async (organization: Organization) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { role: "admin" },
    })
    authSubject = organizationAdminAuthSubject
  }

  describe("EvaluationExtractionRunsRoutes.createOne", () => {
    const payload: typeof EvaluationExtractionRunsRoutes.createOne.request = {
      payload: {
        evaluationExtractionDatasetId: randomUUID(),
        agentId: randomUUID(),
        agentSettingsRevision: null,
        keyMapping: [],
      },
    }

    const subject = async (
      requestPayload?: typeof EvaluationExtractionRunsRoutes.createOne.request,
    ) =>
      request({
        route: EvaluationExtractionRunsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: requestPayload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(payload), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(payload), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = "another-oidc-subject"
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to create an evaluation run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow an organization admin without a project role to create an evaluation run", async () => {
      const { organization } = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionRunsRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionRunsRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
      })

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
      authSubject = "another-oidc-subject"
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to list evaluation runs", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow an organization admin without a project role to list evaluation runs", async () => {
      const { organization } = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows a project admin to list evaluation runs", async () => {
      await createContextForRole("admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("EvaluationExtractionRunsRoutes.getOne", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionRunsRoutes.getOne,
        pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
        token: accessToken ?? undefined,
      })

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
      authSubject = "another-oidc-subject"
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to get an evaluation run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows a project admin to get an evaluation run", async () => {
      await createContextForRole("admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("EvaluationExtractionRunsRoutes.executeOne", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionRunsRoutes.executeOne,
        pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
        token: accessToken ?? undefined,
      })

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
      authSubject = "another-oidc-subject"
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to execute an evaluation run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionRunsRoutes.cancelOne", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionRunsRoutes.cancelOne,
        pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
        token: accessToken ?? undefined,
      })

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
      authSubject = "another-oidc-subject"
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to cancel an evaluation run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionRunsRoutes.getRecords", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionRunsRoutes.getRecords,
        pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
        token: accessToken ?? undefined,
      })

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
      authSubject = "another-oidc-subject"
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to get evaluation run records", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionRunsRoutes.deleteOne", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionRunsRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
        token: accessToken ?? undefined,
      })

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
      authSubject = "another-oidc-subject"
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to delete an evaluation run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow an organization admin without a project role to delete an evaluation run", async () => {
      const { organization } = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows a project admin to delete an evaluation run", async () => {
      await createContextForRole("admin")
      expectResponse(await subject(), 200)
    })
  })
})
