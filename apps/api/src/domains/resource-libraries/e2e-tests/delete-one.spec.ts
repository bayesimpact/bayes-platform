import { ResourceLibrariesRoutes } from "@caseai-connect/api-contracts"
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
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { ResourceLibrariesModule } from "../resource-libraries.module"
import { ResourceLibrary } from "../resource-library.entity"
import { createResourceLibraryForProject } from "../resource-library.factory"

describe("ResourceLibraries - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let resourceLibraryId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ResourceLibrariesModule],
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
    await app.close()
  })

  const subject = async () =>
    request({
      route: ResourceLibrariesRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, resourceLibraryId }),
      token: accessToken,
    })

  it("soft-deletes the library and clears its agent join rows", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
    })
    resourceLibraryId = resourceLibrary.id

    const agent = agentFactory.transient({ organization, project }).build()
    agent.resourceLibraries = [resourceLibrary]
    await repositories.agentRepository.save(agent)

    expectResponse(await subject(), 200)

    const stored = await setup
      .getRepository(ResourceLibrary)
      .findOne({ where: { id: resourceLibraryId } })
    expect(stored).toBeNull()

    const joinRows = await setup.dataSource.query(
      "SELECT * FROM agent_resource_library WHERE resource_library_id = $1",
      [resourceLibraryId],
    )
    expect(joinRows).toHaveLength(0)
  })
})
