import type { ToolSet } from "ai"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"
import type { AgentSubAgentsService } from "@/domains/agents/sub-agents/agent-sub-agents.service"
import type { ProjectsService } from "@/domains/projects/projects.service"
import type { StreamingSession } from "./streaming-session.types"
import { type SubAgentToolInput, subAgentTool } from "./tools/sub-agent.tool"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

export type BuiltTools = {
  tools: ToolSet | undefined
  mcpClose?: () => Promise<void>
  toolDescriptions: Record<string, string>
}

type BuildLLMConfig = (params: {
  model: Agent["model"]
  systemPrompt: string
  temperature: Agent["temperature"]
  tools?: ToolSet
}) => LLMConfig

type GenerateMasterPrompt = (params: {
  agent: Agent
  toolDescriptions?: Record<string, string>
  toolNames: string[]
}) => string

type BuildTools = (params: {
  agent: Agent
  connectScope: RequiredConnectScope
  includeSessionMetadataTools?: boolean
  includeSubAgentTools?: boolean
  onExecute: (toolExecution: ToolExecutionLog) => void
  session?: StreamingSession
  sessionId: string
}) => Promise<BuiltTools>

export async function buildSubAgentTools({
  agent,
  agentSubAgentsService,
  buildLLMConfig,
  buildTools,
  connectScope,
  generateMasterPrompt,
  getProviderForModel,
  onExecute,
  projectsService,
  session,
  sessionId,
}: {
  agent: Agent
  agentSubAgentsService: AgentSubAgentsService
  buildLLMConfig: BuildLLMConfig
  buildTools: BuildTools
  connectScope: RequiredConnectScope
  generateMasterPrompt: GenerateMasterPrompt
  getProviderForModel: (model: string) => LLMProvider
  onExecute: (toolExecution: ToolExecutionLog) => void
  projectsService: ProjectsService
  session?: StreamingSession
  sessionId: string
}): Promise<{ tools: ToolSet; toolDescriptions: Record<string, string> }> {
  const hasAgentOrchestration = await projectsService.hasFeature({
    connectScope,
    feature: "agent-orchestration",
  })
  if (!hasAgentOrchestration) {
    return { tools: {}, toolDescriptions: {} }
  }

  const subAgents = await agentSubAgentsService.listSubAgents({
    connectScope,
    parentAgent: agent,
  })
  const tools: ToolSet = {}
  const toolDescriptions: Record<string, string> = {}

  for (const subAgent of subAgents) {
    if (!subAgent.enabled) continue

    const description = buildSubAgentToolDescription(subAgent)
    tools[subAgent.toolName] = subAgentTool({
      description,
      toolName: subAgent.toolName,
      onExecute,
      execute: (input) =>
        runSubAgentTool({
          buildLLMConfig,
          buildTools,
          connectScope,
          generateMasterPrompt,
          getProviderForModel,
          input,
          onExecute,
          parentAgent: agent,
          session,
          sessionId,
          subAgent,
        }),
    })
    toolDescriptions[subAgent.toolName] = description
  }

  return { tools, toolDescriptions }
}

async function runSubAgentTool({
  buildLLMConfig,
  buildTools,
  connectScope,
  generateMasterPrompt,
  getProviderForModel,
  input,
  onExecute,
  parentAgent,
  session,
  sessionId,
  subAgent,
}: {
  buildLLMConfig: BuildLLMConfig
  buildTools: BuildTools
  connectScope: RequiredConnectScope
  generateMasterPrompt: GenerateMasterPrompt
  getProviderForModel: (model: string) => LLMProvider
  input: SubAgentToolInput
  onExecute: (toolExecution: ToolExecutionLog) => void
  parentAgent: Agent
  session?: StreamingSession
  sessionId: string
  subAgent: AgentSubAgent
}): Promise<string> {
  const childAgent = subAgent.childAgent
  const { tools, mcpClose, toolDescriptions } = await buildTools({
    agent: childAgent,
    sessionId,
    session,
    connectScope,
    includeSessionMetadataTools: false,
    includeSubAgentTools: false,
    onExecute: (toolExecution) =>
      onExecute({
        ...toolExecution,
        notifyToolName: subAgent.toolName,
      }),
  })

  try {
    const toolNames = tools ? Object.keys(tools) : []
    const config = buildLLMConfig({
      systemPrompt: generateMasterPrompt({
        agent: childAgent,
        toolNames,
        toolDescriptions,
      }),
      model: childAgent.model,
      temperature: childAgent.temperature,
      tools,
    })
    const metadata = buildSubAgentMetadata({
      childAgent,
      connectScope,
      parentAgent,
      session,
      sessionId,
    })
    const chunks = getProviderForModel(config.model).streamChatResponse({
      messages: [{ role: "user", content: buildSubAgentPrompt(input) }],
      config,
      metadata,
    })

    let answer = ""
    for await (const chunk of chunks) answer += chunk
    return answer
  } finally {
    await mcpClose?.()
  }
}

function buildSubAgentPrompt(input: SubAgentToolInput): string {
  const context = input.context.trim()
  return [
    "You are being invoked as a sub-agent by another assistant.",
    context ? `Conversation context:\n${context}` : undefined,
    `Delegated task:\n${input.task}`,
    "Return a direct answer that the parent assistant can use for the user.",
  ]
    .filter((part): part is string => part !== undefined)
    .join("\n\n")
}

function buildSubAgentMetadata({
  childAgent,
  connectScope,
  parentAgent,
  session,
  sessionId,
}: {
  childAgent: Agent
  connectScope: RequiredConnectScope
  parentAgent: Agent
  session?: StreamingSession
  sessionId: string
}): LLMMetadata {
  return {
    traceId: session?.traceId ?? sessionId,
    agentSessionId: session?.id ?? sessionId,
    agentId: childAgent.id,
    projectId: childAgent.projectId,
    organizationId: session?.organizationId ?? connectScope.organizationId,
    currentTurn: session?.messages.filter((message) => message.role === "user").length ?? 0,
    tags: [parentAgent.name, childAgent.name, "sub-agent"],
  }
}

function buildSubAgentToolDescription(subAgent: AgentSubAgent): string {
  const configuredDescription = subAgent.description.trim()
  if (configuredDescription.length > 0) return configuredDescription

  return `Delegate to ${subAgent.childAgent.name}, a conversation agent, when that agent is better suited to the user's request.`
}
