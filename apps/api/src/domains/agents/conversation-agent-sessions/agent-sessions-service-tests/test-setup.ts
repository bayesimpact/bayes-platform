import { afterAll } from "@jest/globals"
import type { Repository } from "typeorm"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { Agent } from "@/domains/agents/agent.entity"
import { agentFactory } from "@/domains/agents/agent.factory"
import { AgentCategory } from "@/domains/agents/categories/agent-category.entity"
import { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { Project } from "@/domains/projects/project.entity"
import { projectFactory } from "@/domains/projects/project.factory"
import { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import { StreamingService } from "../../shared/agent-session-messages/streaming/streaming.service"
import { ConversationAgentSession } from "../conversation-agent-session.entity"
import { ConversationAgentSessionCategory } from "../conversation-agent-session-category.entity"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions.module"
import { ConversationAgentSessionsService } from "../conversation-agent-sessions.service"

export function agentSessionControllerTestSetup() {
  let service: ConversationAgentSessionsService
  let streamingService: StreamingService
  let conversationAgentSessionRepository: Repository<ConversationAgentSession>
  let conversationAgentSessionCategoryRepository: Repository<ConversationAgentSessionCategory>
  let agentRepository: Repository<Agent>
  let agentCategoryRepository: Repository<AgentCategory>
  let agentSubAgentRepository: Repository<AgentSubAgent>
  let agentMessageRepository: Repository<AgentMessage>
  let featureFlagRepository: AllRepositories["featureFlagRepository"]
  let userRepository: Repository<User>
  let organizationRepository: Repository<Organization>
  let projectRepository: Repository<Project>
  let organizationMembershipRepository: Repository<OrganizationMembership>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  // Test data
  let testUser: User
  let testOrganization: Organization
  let testProject: Project
  let testAgent: Agent

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
    })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<ConversationAgentSessionsService>(ConversationAgentSessionsService)
    streamingService = setup.module.get<StreamingService>(StreamingService)
    conversationAgentSessionRepository = setup.getRepository(ConversationAgentSession)
    conversationAgentSessionCategoryRepository = setup.getRepository(
      ConversationAgentSessionCategory,
    )
    agentMessageRepository = setup.getRepository(AgentMessage)
    agentRepository = setup.getRepository(Agent)
    agentCategoryRepository = setup.getRepository(AgentCategory)
    agentSubAgentRepository = setup.getRepository(AgentSubAgent)
    userRepository = setup.getRepository(User)
    featureFlagRepository = setup.getAllRepositories().featureFlagRepository
    organizationRepository = setup.getRepository(Organization)
    projectRepository = setup.getRepository(Project)
    organizationMembershipRepository = setup.getRepository(OrganizationMembership)

    // Use unique identifier to avoid conflicts between tests
    const uniqueId = Date.now().toString()

    const organization = organizationFactory.build({
      name: `Org for Membership ${uniqueId}`,
    })
    testOrganization = organizationRepository.create(organization)
    testOrganization = await organizationRepository.save(testOrganization)

    const user = userFactory.build({
      auth0Id: `auth0|test-user-${uniqueId}`,
      email: `test-${uniqueId}@example.com`,
      name: "Test User",
    })
    testUser = userRepository.create(user)
    testUser = await userRepository.save(testUser)

    const project = projectFactory.transient({ organization: testOrganization }).build({
      name: `Test Project ${uniqueId}`,
    })
    testProject = projectRepository.create(project)
    testProject = await projectRepository.save(testProject)

    const agent = agentFactory
      .transient({ organization: testOrganization, project: testProject })
      .build({
        name: `Test Agent ${uniqueId}`,
        defaultPrompt: "You are a helpful assistant",
        temperature: 0,
      })
    testAgent = agentRepository.create(agent)
    testAgent = await agentRepository.save(testAgent)
  })

  return () => {
    return {
      agentRepository,
      agentCategoryRepository,
      agentSubAgentRepository,
      conversationAgentSessionRepository,
      conversationAgentSessionCategoryRepository,
      featureFlagRepository,
      agentMessageRepository,
      organizationMembershipRepository,
      organizationRepository,
      projectRepository,
      service,
      testAgent,
      testOrganization,
      testProject,
      testUser,
      userRepository,
      streamingService,
    }
  }
}
