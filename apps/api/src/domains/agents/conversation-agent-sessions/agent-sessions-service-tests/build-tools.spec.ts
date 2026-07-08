import { DocumentsRagMode, ToolName } from "@caseai-connect/api-contracts"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { addFeature } from "@/domains/organizations/organization.factory"
import type { StreamingService } from "../../shared/agent-session-messages/streaming/streaming.service"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

type AgentSessionScope = Parameters<StreamingService["streamAgentResponse"]>[0]["agentSessionScope"]

type BuildToolsArgs = {
  agentSessionScope: AgentSessionScope
  onExecute: () => void
}

const buildSessionStub = (sessionId: string): AgentSessionScope["session"] =>
  ({
    id: sessionId,
    traceId: sessionId,
    organizationId: "organization-id",
  }) as AgentSessionScope["session"]

type BuildToolsAccessor = {
  buildTools: (args: BuildToolsArgs) => Promise<{
    toolDescriptions: Record<string, string>
    tools: Record<string, unknown> | undefined
  }>
}

describe("buildTools", () => {
  it("should omit document retrieval when documentsRagMode is none", async () => {
    const { toolsService, testAgent, testAgentSettings, testOrganization, testProject } =
      getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: testAgent,
        agentSettings: { ...testAgentSettings, documentsRagMode: DocumentsRagMode.None },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeUndefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose document retrieval when documentsRagMode is all", async () => {
    const { toolsService, testAgent, testAgentSettings, testOrganization, testProject } =
      getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: testAgent,
        agentSettings: { ...testAgentSettings, documentsRagMode: DocumentsRagMode.All },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeDefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose document retrieval when documentsRagMode is tags", async () => {
    const { toolsService, testAgent, testAgentSettings, testOrganization, testProject } =
      getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: testAgent,
        agentSettings: { ...testAgentSettings, documentsRagMode: DocumentsRagMode.Tags },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeDefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose metadata recalculation tool when agent has categories", async () => {
    const {
      toolsService,
      service,
      testAgent,
      testAgentSettings,
      testOrganization,
      testProject,
      testUser,
      agentSessionCategoryRepository,
      agentRepository,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    await agentSessionCategoryRepository.save(
      agentSessionCategoryRepository.create({
        agentId: testAgent.id,
        name: "billing",
      }),
    )

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    //reload agent object to load new associated categories
    const agent = await agentRepository.findOne({
      where: { id: testAgent.id },
      relations: ["sessionCategories"],
    })
    if (!agent) throw new Error("Agent not found")

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: agent,
        agentSettings: { ...testAgentSettings, documentsRagMode: DocumentsRagMode.None },
        session,
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeDefined()
  })

  it("should omit configured sub-agent tools when orchestration feature is disabled", async () => {
    const {
      agentRepository,
      agentSettingsRepository,
      agentSubAgentRepository,
      toolsService,
      testAgent,
      testAgentSettings,
      testOrganization,
      testProject,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }
    const childAgent = await agentRepository.save(
      agentRepository.create({
        organizationId: testOrganization.id,
        projectId: testProject.id,
        name: "Benefits Specialist",
        type: "conversation",
      }),
    )
    await agentSettingsRepository.save(
      agentSettingsRepository.create({
        organizationId: testOrganization.id,
        projectId: testProject.id,
        agentId: childAgent.id,
        instructions: "Answer benefits questions",
        model: testAgentSettings.model,
        temperature: testAgentSettings.temperature,
        locale: testAgentSettings.locale,
        documentsRagMode: DocumentsRagMode.None,
        revision: 1,
      }),
    )
    await agentSubAgentRepository.save(
      agentSubAgentRepository.create({
        parentAgentId: testAgent.id,
        childAgentId: childAgent.id,
        toolName: "benefits_specialist",
        description: "Answer benefit eligibility questions.",
        enabled: true,
      }),
    )

    const { tools, toolDescriptions } = await (
      toolsService as unknown as BuildToolsAccessor
    ).buildTools({
      agentSessionScope: {
        agent: testAgent,
        agentSettings: { ...testAgentSettings, documentsRagMode: DocumentsRagMode.None },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.benefits_specialist).toBeUndefined()
    expect(toolDescriptions.benefits_specialist).toBeUndefined()
  })

  it("should expose enabled sub-agent tools when orchestration feature is enabled", async () => {
    const {
      agentRepository,
      agentSettingsRepository,
      agentSubAgentRepository,
      featureFlagRepository,
      toolsService,
      testAgent,
      testAgentSettings,
      testOrganization,
      testProject,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }
    await addFeature({
      featureFlagRepository,
      projectId: testProject.id,
      featureFlagKey: "agent-orchestration",
    })
    const childAgent = await agentRepository.save(
      agentRepository.create({
        organizationId: testOrganization.id,
        projectId: testProject.id,
        name: "Benefits Specialist",
        type: "conversation",
      }),
    )
    const _childAgentSettings = await agentSettingsRepository.save(
      agentSettingsRepository.create(
        agentSettingsFactory
          .transient({ organization: testOrganization, project: testProject, agent: childAgent })
          .build({
            instructions: "Answer benefits questions",
            documentsRagMode: DocumentsRagMode.None,
            outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
          }),
      ),
    )
    await agentSubAgentRepository.save(
      agentSubAgentRepository.create({
        parentAgentId: testAgent.id,
        childAgentId: childAgent.id,
        toolName: "benefits_specialist",
        description: "Answer benefit eligibility questions.",
        enabled: true,
      }),
    )

    const { tools, toolDescriptions } = await (
      toolsService as unknown as BuildToolsAccessor
    ).buildTools({
      agentSessionScope: {
        agent: testAgent,
        agentSettings: { ...testAgentSettings, documentsRagMode: DocumentsRagMode.None },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.benefits_specialist).toBeDefined()
    expect(toolDescriptions.benefits_specialist).toBe("Answer benefit eligibility questions.")
  })
})
