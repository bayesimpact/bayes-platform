import { randomUUID } from "node:crypto"
import {
  REVIEWER_UI_READ_PERMISSION,
  TESTER_UI_READ_PERMISSION,
} from "@caseai-connect/api-contracts"
import {
  DESK_UI_READ_PERMISSION,
  DeskProjectsRoutes,
  SOURCES_TOOL_FEATURE_FLAG,
} from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  addFeature,
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  PROJECT_PERMISSIONS_FROM_REVIEW_CAMPAIGN,
  PROJECT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import type { ReviewCampaignStatus } from "@/domains/review-campaigns/review-campaigns.types"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk projects - getAllMine", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  // The caller holds an organization member row and a campaign role only. The organization has a
  // second project the caller has nothing on.
  const createCampaignParticipantContext = async ({
    status = "active",
    roleKey = "review_campaign_tester",
  }: {
    status?: ReviewCampaignStatus
    roleKey?: ReviewCampaignRoleKey
  } = {}) => {
    const { organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    await repositories.projectRepository.save(projectFactory.transient({ organization }).build())
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory[status]()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const participantAuthSubject = `oidc|${randomUUID()}`
    const { user } = await addUserToReviewCampaign({
      repositories,
      organization,
      project,
      campaign,
      roleKeys: [roleKey],
      user: {
        authSubject: participantAuthSubject,
        email: mockOidcEmailForSub(participantAuthSubject),
      },
    })
    authSubject = participantAuthSubject
    return { organization, project, campaign, user }
  }

  const subject = async () => request({ route: DeskProjectsRoutes.getAllMine, token: "token" })

  it("returns the projects of an owner with only the fields of the contract", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
    })
    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: SOURCES_TOOL_FEATURE_FLAG,
    })

    const response = await subject()

    expectSchemaResponse(DeskProjectsRoutes.getAllMine, response, 200)
    expect(response.body.data).toStrictEqual([
      {
        id: project.id,
        name: project.name,
        organizationId: organization.id,
        permissions: expect.arrayContaining([DESK_UI_READ_PERMISSION, PROJECT_READ_PERMISSION]),
        featureFlags: [SOURCES_TOOL_FEATURE_FLAG],
      },
    ])
  })

  it("lists only the campaign's project for a tester of an active campaign, with the campaign keys", async () => {
    const { project } = await createCampaignParticipantContext()

    const response = await subject()

    expectSchemaResponse(DeskProjectsRoutes.getAllMine, response, 200)
    expect(response.body.data.map((listedProject) => listedProject.id)).toEqual([project.id])
    const [listedProject] = response.body.data
    expect([...(listedProject?.permissions ?? [])].sort()).toEqual(
      PROJECT_PERMISSIONS_FROM_REVIEW_CAMPAIGN.filter(
        (permission) => permission !== REVIEWER_UI_READ_PERMISSION,
      ).sort(),
    )
    expect(listedProject?.permissions).toContain(TESTER_UI_READ_PERMISSION)
    expect(listedProject?.permissions).not.toContain(DESK_UI_READ_PERMISSION)
  })

  it.each([
    ["draft"],
    ["closed"],
  ] as const)("lists nothing for a tester of a %s campaign", async (status) => {
    await createCampaignParticipantContext({ status })

    const response = await subject()

    expectSchemaResponse(DeskProjectsRoutes.getAllMine, response, 200)
    expect(response.body.data).toEqual([])
  })

  it("lists the campaign's project for a reviewer of a closed campaign", async () => {
    const { project } = await createCampaignParticipantContext({
      status: "closed",
      roleKey: "review_campaign_reviewer",
    })

    const response = await subject()

    expectSchemaResponse(DeskProjectsRoutes.getAllMine, response, 200)
    expect(response.body.data.map((listedProject) => listedProject.id)).toEqual([project.id])
    expect([...(response.body.data[0]?.permissions ?? [])].sort()).toEqual(
      [PROJECT_READ_PERMISSION, REVIEWER_UI_READ_PERMISSION].sort(),
    )
  })

  it("lists the project once for a tester who is also a project member, with both sets of keys", async () => {
    const { project, user } = await createCampaignParticipantContext()
    await addUserToProject({
      repositories,
      project,
      user,
      membership: { roleKeys: ["project_member"] },
    })

    const response = await subject()

    expectSchemaResponse(DeskProjectsRoutes.getAllMine, response, 200)
    expect(response.body.data.map((listedProject) => listedProject.id)).toEqual([project.id])
    expect(response.body.data[0]?.permissions).toEqual(
      expect.arrayContaining([DESK_UI_READ_PERMISSION, TESTER_UI_READ_PERMISSION]),
    )
  })
})
