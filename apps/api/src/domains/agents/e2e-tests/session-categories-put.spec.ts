import { randomUUID } from "node:crypto"
import { AgentsRoutes, type UpdateAgentSessionCategoriesDto } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { Project } from "@/domains/projects/project.entity"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"
import type { ProjectAgentSessionCategory } from "../session-categories/project-agent-session-category.entity"

describe("Agents - updateSessionCategories", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent }
  }

  const seedTwoProjectCategories = async (
    project: Project,
  ): Promise<[ProjectAgentSessionCategory, ProjectAgentSessionCategory]> => {
    const first = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Billing",
      }),
    )
    const second = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Support",
      }),
    )
    return [first, second]
  }

  let payload: UpdateAgentSessionCategoriesDto = { projectAgentSessionCategoryIds: [] }

  const subject = async () =>
    request({
      route: AgentsRoutes.updateSessionCategories,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      request: { payload },
      token: accessToken,
    })

  it("should activate the given categories", async () => {
    const { project } = await createContext()
    const [first, second] = await seedTwoProjectCategories(project)
    payload = { projectAgentSessionCategoryIds: [first.id, second.id] }

    const response = await subject()

    expectResponse(response, 200)
    const stored = await repositories.agentSessionCategoryRepository.find({ where: { agentId } })
    expect(stored.map((category) => category.projectAgentSessionCategoryId).sort()).toEqual(
      [first.id, second.id].sort(),
    )
  })

  it("should drop the categories the payload omits", async () => {
    const { project } = await createContext()
    const [first, second] = await seedTwoProjectCategories(project)
    payload = { projectAgentSessionCategoryIds: [first.id, second.id] }
    await subject()
    payload = { projectAgentSessionCategoryIds: [first.id] }

    const response = await subject()

    expectResponse(response, 200)
    // replaceActiveCategoriesForAgent soft-deletes dropped rows; the default (non-withDeleted)
    // find already excludes them, so this reads the same active set the app sees.
    const stored = await repositories.agentSessionCategoryRepository.find({ where: { agentId } })
    expect(stored.map((category) => category.projectAgentSessionCategoryId)).toEqual([first.id])
  })

  it("should reject an unknown category id", async () => {
    await createContext()
    payload = { projectAgentSessionCategoryIds: [randomUUID()] }

    const response = await subject()

    expectResponse(response, 422, "One or more session categories do not exist")
  })
})
