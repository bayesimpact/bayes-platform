import {
  AgentLocale,
  AgentModel,
  AgentsRoutes,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
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
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { AgentsModule } from "@/domains/agents/agents.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { createResourceLibraryForProject } from "../resource-library.factory"

describe("Agents - resource library selection", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ActivitiesModule],
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
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const createAgent = async (payload: typeof AgentsRoutes.createOne.request) =>
    request({
      route: AgentsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  const baseAgentPayload = {
    name: "Helpful Assistant",
    defaultPrompt: "You are helpful",
    documentsRagMode: DocumentsRagMode.All,
    model: AgentModel.Gemini25Flash,
    temperature: 0,
    locale: AgentLocale.EN,
    tagsToAdd: [] as string[],
    projectAgentSessionCategoryIds: [] as string[],
  }

  it("attaches selected resource libraries to a conversation agent", async () => {
    const { organization, project } = await createContext()
    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
    })

    const response = await createAgent({
      payload: {
        ...baseAgentPayload,
        type: "conversation",
        resourceLibraryIds: [resourceLibrary.id],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.resourceLibraryIds).toEqual([resourceLibrary.id])

    const joinRows = await setup.dataSource.query(
      "SELECT * FROM agent_resource_library WHERE resource_library_id = $1",
      [resourceLibrary.id],
    )
    expect(joinRows).toHaveLength(1)
  })

  it("rejects attaching resource libraries to an extraction agent", async () => {
    const { organization, project } = await createContext()
    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
    })

    const response = await createAgent({
      payload: {
        ...baseAgentPayload,
        type: "extraction",
        outputJsonSchema: {
          type: "object",
          properties: { summary: { type: "string" } },
        },
        resourceLibraryIds: [resourceLibrary.id],
      },
    })

    expectResponse(response, 400)
  })
})
