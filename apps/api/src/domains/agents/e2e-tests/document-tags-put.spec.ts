import { randomUUID } from "node:crypto"
import { AgentsRoutes, type UpdateAgentDocumentTagsDto } from "@caseai-connect/api-contracts"
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
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { Project } from "@/domains/projects/project.entity"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import type { Agent } from "../agent.entity"
import { AgentsModule } from "../agents.module"

describe("Agents - updateDocumentTags", () => {
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

  const seedThreeTags = async ({
    organization,
    project,
  }: {
    organization: Organization
    project: Project
  }): Promise<[DocumentTag, DocumentTag, DocumentTag]> => {
    const documentTagRepository = setup.getRepository(DocumentTag)
    const keptTag = await documentTagRepository.save(
      documentTagFactory.transient({ organization, project }).build(),
    )
    const removedTag = await documentTagRepository.save(
      documentTagFactory.transient({ organization, project }).build(),
    )
    const addedTag = await documentTagRepository.save(
      documentTagFactory.transient({ organization, project }).build(),
    )
    return [keptTag, removedTag, addedTag]
  }

  const attachTagsToAgent = async (agent: Agent, tags: DocumentTag[]): Promise<void> => {
    agent.documentTags = tags
    await repositories.agentRepository.save(agent)
  }

  let payload: UpdateAgentDocumentTagsDto = { documentTagIds: [] }

  const subject = async () =>
    request({
      route: AgentsRoutes.updateDocumentTags,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      request: { payload },
      token: accessToken,
    })

  it("should attach the given tags and detach the others", async () => {
    const { organization, project, agent } = await createContext()
    const [keptTag, removedTag, addedTag] = await seedThreeTags({ organization, project })
    await attachTagsToAgent(agent, [keptTag, removedTag])
    payload = { documentTagIds: [keptTag.id, addedTag.id] }

    const response = await subject()

    expectResponse(response, 200)
    const stored = await repositories.agentRepository.findOne({
      where: { id: agentId },
      relations: { documentTags: true },
    })
    expect(stored?.documentTags.map((tag) => tag.id).sort()).toEqual(
      [keptTag.id, addedTag.id].sort(),
    )
  })

  it("should detach every tag when given an empty list", async () => {
    const { organization, project, agent } = await createContext()
    const [tag] = await seedThreeTags({ organization, project })
    await attachTagsToAgent(agent, [tag])
    payload = { documentTagIds: [] }

    const response = await subject()

    expectResponse(response, 200)
    const stored = await repositories.agentRepository.findOne({
      where: { id: agentId },
      relations: { documentTags: true },
    })
    expect(stored?.documentTags).toEqual([])
  })

  it("should reject an unknown tag id", async () => {
    await createContext()
    payload = { documentTagIds: [randomUUID()] }

    const response = await subject()

    expectResponse(response, 422)
  })
})
