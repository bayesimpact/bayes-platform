import { AgentsRoutes, type UpdateAgentResourceLibrariesDto } from "@caseai-connect/api-contracts"
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
import { resourceLibraryFactory } from "@/domains/resource-libraries/resource-library.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agents - updateResourceLibraries", () => {
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

  let payload: UpdateAgentResourceLibrariesDto = { resourceLibraryIds: [] }

  const subject = async () =>
    request({
      route: AgentsRoutes.updateResourceLibraries,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      request: { payload },
      token: accessToken,
    })

  it("should keep only the given libraries", async () => {
    const { organization, project, agent } = await createContext()
    const keptLibrary = resourceLibraryFactory.transient({ organization, project }).build()
    const removedLibrary = resourceLibraryFactory.transient({ organization, project }).build()
    await repositories.resourceLibraryRepository.save([keptLibrary, removedLibrary])
    agent.resourceLibraries = [keptLibrary, removedLibrary]
    await repositories.agentRepository.save(agent)
    payload = { resourceLibraryIds: [keptLibrary.id] }

    const response = await subject()

    expectResponse(response, 200)
    const stored = await repositories.agentRepository.findOne({
      where: { id: agentId },
      relations: { resourceLibraries: true },
    })
    expect(stored?.resourceLibraries.map((library) => library.id)).toEqual([keptLibrary.id])
  })

  it("should detach every library when given an empty list", async () => {
    const { organization, project, agent } = await createContext()
    const library = resourceLibraryFactory.transient({ organization, project }).build()
    await repositories.resourceLibraryRepository.save(library)
    agent.resourceLibraries = [library]
    await repositories.agentRepository.save(agent)
    payload = { resourceLibraryIds: [] }

    const response = await subject()

    expectResponse(response, 200)
    const stored = await repositories.agentRepository.findOne({
      where: { id: agentId },
      relations: { resourceLibraries: true },
    })
    expect(stored?.resourceLibraries).toEqual([])
  })

  it("should reject libraries on an extraction agent", async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      agent: { type: "extraction" },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    const library = resourceLibraryFactory.transient({ organization, project }).build()
    await repositories.resourceLibraryRepository.save(library)
    payload = { resourceLibraryIds: [library.id] }

    const response = await subject()

    expectResponse(response, 422, "Resource libraries can only be attached to conversation agents")
  })
})
