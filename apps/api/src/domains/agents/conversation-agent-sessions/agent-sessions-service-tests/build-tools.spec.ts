import { DocumentsRagMode, ToolName } from "@caseai-connect/api-contracts"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
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
    const { toolsService, testAgent, testOrganization, testProject } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: { ...testAgent, documentsRagMode: DocumentsRagMode.None },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeUndefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose document retrieval when documentsRagMode is all", async () => {
    const { toolsService, testAgent, testOrganization, testProject } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: { ...testAgent, documentsRagMode: DocumentsRagMode.All },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeDefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose document retrieval when documentsRagMode is tags", async () => {
    const { toolsService, testAgent, testOrganization, testProject } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: { ...testAgent, documentsRagMode: DocumentsRagMode.Tags },
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
      testOrganization,
      testProject,
      testUser,
      agentSessionCategoryRepository,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const savedCategory = await agentSessionCategoryRepository.save(
      agentSessionCategoryRepository.create({
        agentId: testAgent.id,
        name: "billing",
      }),
    )
    const session = await service.createSession({
      connectScope,
      agentId: testAgent.id,
      userId: testUser.id,
      type: "playground",
    })

    const { tools } = await (toolsService as unknown as BuildToolsAccessor).buildTools({
      agentSessionScope: {
        agent: {
          ...testAgent,
          sessionCategories: [savedCategory],
          documentsRagMode: DocumentsRagMode.None,
        },
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
      agentSubAgentRepository,
      toolsService,
      testAgent,
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
        defaultPrompt: "Answer benefits questions",
        model: testAgent.model,
        temperature: testAgent.temperature,
        locale: testAgent.locale,
        type: "conversation",
        documentsRagMode: DocumentsRagMode.None,
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
        agent: { ...testAgent, documentsRagMode: DocumentsRagMode.None },
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
      agentSubAgentRepository,
      featureFlagRepository,
      toolsService,
      testAgent,
      testOrganization,
      testProject,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }
    await featureFlagRepository.save(
      featureFlagRepository.create({
        projectId: testProject.id,
        featureFlagKey: "agent-orchestration",
        enabled: true,
      }),
    )
    const childAgent = await agentRepository.save(
      agentRepository.create({
        organizationId: testOrganization.id,
        projectId: testProject.id,
        name: "Benefits Specialist",
        defaultPrompt: "Answer benefits questions",
        model: testAgent.model,
        temperature: testAgent.temperature,
        locale: testAgent.locale,
        type: "conversation",
        documentsRagMode: DocumentsRagMode.None,
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
        agent: { ...testAgent, documentsRagMode: DocumentsRagMode.None },
        session: buildSessionStub("session-id"),
        connectScope,
      },
      onExecute: () => undefined,
    })

    expect(tools?.benefits_specialist).toBeDefined()
    expect(toolDescriptions.benefits_specialist).toBe("Answer benefit eligibility questions.")
  })
})
