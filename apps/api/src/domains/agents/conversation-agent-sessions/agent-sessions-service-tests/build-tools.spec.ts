import { DocumentsRagMode, ToolName } from "@caseai-connect/api-contracts"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { StreamingService } from "../../shared/agent-session-messages/streaming/streaming.service"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

type BuildToolsArgs = {
  agent: Parameters<StreamingService["streamAgentResponse"]>[0]["agent"]
  sessionId: string
  connectScope: RequiredConnectScope
  onExecute: () => void
}

type BuildToolsAccessor = {
  buildTools: (args: BuildToolsArgs) => Promise<{
    toolDescriptions: Record<string, string>
    tools: Record<string, unknown> | undefined
  }>
}

describe("buildTools", () => {
  it("should omit document retrieval when documentsRagMode is none", async () => {
    const { streamingService, testAgent, testOrganization, testProject } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (streamingService as unknown as BuildToolsAccessor).buildTools({
      agent: { ...testAgent, documentsRagMode: DocumentsRagMode.None },
      sessionId: "session-id",
      connectScope,
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeUndefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose document retrieval when documentsRagMode is all", async () => {
    const { streamingService, testAgent, testOrganization, testProject } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (streamingService as unknown as BuildToolsAccessor).buildTools({
      agent: { ...testAgent, documentsRagMode: DocumentsRagMode.All },
      sessionId: "session-id",
      connectScope,
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeDefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose document retrieval when documentsRagMode is tags", async () => {
    const { streamingService, testAgent, testOrganization, testProject } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const { tools } = await (streamingService as unknown as BuildToolsAccessor).buildTools({
      agent: { ...testAgent, documentsRagMode: DocumentsRagMode.Tags },
      sessionId: "session-id",
      connectScope,
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RetrieveProjectDocumentChunks]).toBeDefined()
    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeUndefined()
  })

  it("should expose metadata recalculation tool when agent has categories", async () => {
    const {
      streamingService,
      service,
      testAgent,
      testOrganization,
      testProject,
      testUser,
      agentCategoryRepository,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const savedCategory = await agentCategoryRepository.save(
      agentCategoryRepository.create({
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

    const { tools } = await (streamingService as unknown as BuildToolsAccessor).buildTools({
      agent: {
        ...testAgent,
        categories: [savedCategory],
        documentsRagMode: DocumentsRagMode.None,
      },
      sessionId: session.id,
      connectScope,
      onExecute: () => undefined,
    })

    expect(tools?.[ToolName.RecalculateConversationSessionMetadata]).toBeDefined()
  })

  it("should omit configured sub-agent tools when orchestration feature is disabled", async () => {
    const {
      agentRepository,
      agentSubAgentRepository,
      streamingService,
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
      streamingService as unknown as BuildToolsAccessor
    ).buildTools({
      agent: { ...testAgent, documentsRagMode: DocumentsRagMode.None },
      sessionId: "session-id",
      connectScope,
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
      streamingService,
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
      streamingService as unknown as BuildToolsAccessor
    ).buildTools({
      agent: { ...testAgent, documentsRagMode: DocumentsRagMode.None },
      sessionId: "session-id",
      connectScope,
      onExecute: () => undefined,
    })

    expect(tools?.benefits_specialist).toBeDefined()
    expect(toolDescriptions.benefits_specialist).toBe("Answer benefit eligibility questions.")
  })
})
