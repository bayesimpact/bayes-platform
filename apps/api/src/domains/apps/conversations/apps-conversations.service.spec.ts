import { randomUUID } from "node:crypto"
import { NotFoundException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { appInstallationFactory } from "../app-installation.factory"
import { appManifestFactory } from "../app-manifest.factory"
import { AppsModule } from "../apps.module"
import { AppsConversationsService } from "./apps-conversations.service"

describe("AppsConversationsService", () => {
  let service: AppsConversationsService
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [AppsModule, RbacModule] })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get(AppsConversationsService)
  })

  const createContext = async () => {
    const context = await createOrganizationWithAgent(repositories)
    const manifest = await repositories.appManifestRepository.save(appManifestFactory.build())
    const installation = await repositories.appInstallationRepository.save(
      appInstallationFactory.build({ appManifestId: manifest.id, projectId: context.project.id }),
    )
    const connectScope = {
      organizationId: context.organization.id,
      projectId: context.project.id,
    }
    return { ...context, installation, connectScope }
  }

  it("lists the conversation agents the caller can read in the project", async () => {
    const { organization, project, agent, user, connectScope } = await createContext()
    await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ type: "extraction" }),
    )

    const agents = await service.listAgents({ userId: user.id, connectScope })

    expect(agents.map((listedAgent) => listedAgent.id)).toEqual([agent.id])
  })

  it("opens a conversation tied to the installation and answers it", async () => {
    const { agent, installation, connectScope } = await createContext()

    const conversation = await service.createConversation({
      connectScope,
      appInstallationId: installation.id,
      agentId: agent.id,
      externalUserId: "hashed-sender-1",
    })
    expect(conversation.appInstallationId).toBe(installation.id)
    const stored = await repositories.publicAgentSessionRepository.findOneByOrFail({
      id: conversation.id,
    })
    expect(stored.embedConfigId).toBeNull()

    const reply = await service.sendMessage({
      connectScope,
      appInstallationId: installation.id,
      agentId: agent.id,
      conversationId: conversation.id,
      content: "Hello",
    })
    expect(reply.content).toBe("Hello, I'm the stream default mock value!")
  })

  it("does not find an unknown agent or another installation's conversation", async () => {
    const { agent, installation, connectScope } = await createContext()

    await expect(
      service.createConversation({
        connectScope,
        appInstallationId: installation.id,
        agentId: randomUUID(),
        externalUserId: "hashed-sender-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException)

    const conversation = await service.createConversation({
      connectScope,
      appInstallationId: installation.id,
      agentId: agent.id,
      externalUserId: "hashed-sender-1",
    })
    await expect(
      service.sendMessage({
        connectScope,
        appInstallationId: randomUUID(),
        agentId: agent.id,
        conversationId: conversation.id,
        content: "Hello",
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
