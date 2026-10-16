import { AgentModel, ExtractionAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { documentFactory } from "@/domains/documents/document.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { createSingleUser } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ExtractionAgentSessionsModule } from "../extraction-agent-sessions.module"

describe("ExtractionAgentSessions - listMyDocuments", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ExtractionAgentSessionsModule],
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
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (role: "owner" | "admin" | "member" = "member") => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      projectMembership: { role },
      agent: { type: "extraction" },
      agentSettings: { model: AgentModel._Mock },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = user.authSubject!
    return { user, organization, project }
  }

  const subject = async () =>
    request({
      route: ExtractionAgentSessionsRoutes.live.listMyDocuments,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
    })

  const titlesOf = (response: { body: { data: { title: string }[] } }) =>
    response.body.data.map((document) => document.title)

  it("returns only extraction documents owned by the current user", async () => {
    const { user, organization, project } = await createContext()
    const otherUser = await createSingleUser(repositories.userRepository)

    await repositories.documentRepository.save([
      documentFactory.transient({ organization, project }).build({
        title: "My extraction",
        sourceType: "extraction",
        userId: user.id,
      }),
      documentFactory.transient({ organization, project }).build({
        title: "Other user extraction",
        sourceType: "extraction",
        userId: otherUser.id,
      }),
      documentFactory.transient({ organization, project }).build({
        title: "Orphan extraction",
        sourceType: "extraction",
        userId: null,
      }),
      documentFactory.transient({ organization, project }).build({
        title: "My project doc",
        sourceType: "project",
        userId: user.id,
      }),
    ])

    const response = await subject()

    expectResponse(response, 201)
    expect(titlesOf(response)).toEqual(["My extraction"])
  })

  it("does not include extraction documents from another project", async () => {
    const { user, organization, project } = await createContext()
    const { project: otherProject } = await createOrganizationWithProject(repositories)

    await repositories.documentRepository.save([
      documentFactory.transient({ organization, project }).build({
        title: "My extraction in current project",
        sourceType: "extraction",
        userId: user.id,
      }),
      documentFactory.transient({ organization, project: otherProject }).build({
        title: "My extraction in other project",
        sourceType: "extraction",
        userId: user.id,
      }),
    ])

    const response = await subject()

    expectResponse(response, 201)
    expect(titlesOf(response)).toEqual(["My extraction in current project"])
  })

  it("excludes documents whose upload is still pending", async () => {
    const { user, organization, project } = await createContext()

    await repositories.documentRepository.save([
      documentFactory.transient({ organization, project }).build({
        title: "Uploaded extraction",
        sourceType: "extraction",
        userId: user.id,
        uploadStatus: "uploaded",
      }),
      documentFactory.transient({ organization, project }).build({
        title: "Pending extraction",
        sourceType: "extraction",
        userId: user.id,
        uploadStatus: "pending",
      }),
    ])

    const response = await subject()

    expectResponse(response, 201)
    expect(titlesOf(response)).toEqual(["Uploaded extraction"])
  })

  it("returns an empty array when the user has no extraction documents", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data).toEqual([])
  })

  it("sorts documents newest first", async () => {
    const { user, organization, project } = await createContext()

    await repositories.documentRepository.save([
      documentFactory.transient({ organization, project }).build({
        title: "Older",
        sourceType: "extraction",
        userId: user.id,
        createdAt: new Date("2025-01-01T00:00:00Z"),
      }),
      documentFactory.transient({ organization, project }).build({
        title: "Newer",
        sourceType: "extraction",
        userId: user.id,
        createdAt: new Date("2025-06-01T00:00:00Z"),
      }),
    ])

    const response = await subject()

    expectResponse(response, 201)
    expect(titlesOf(response)).toEqual(["Newer", "Older"])
  })
})
