import { Logger } from "@nestjs/common"
import { trace } from "@opentelemetry/api"
import type { ToolSet } from "ai"
import type {
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import type { FormAgentSessionsService } from "@/domains/agents/form-agent-sessions/form-agent-sessions.service"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import type { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"
import type { AgentSubAgentsService } from "@/domains/agents/sub-agents/agent-sub-agents.service"
import type { ProjectsService } from "@/domains/projects/projects.service"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import type { AgentSessionScope, OnExecute, StreamingSession } from "./streaming-session.types"
import { type SubAgentToolInput, subAgentTool } from "./tools/sub-agent.tool"

const logger = new Logger("SubAgentTools")
const tracer = trace.getTracer("caseai-sub-agent")

export type BuiltTools = {
  tools: ToolSet | undefined
  mcpClose?: () => Promise<void>
  toolDescriptions: Record<string, string>
  hasSubAgentTools: boolean
}

type BuildLLMConfig = (params: {
  model: AgentSettings["model"]
  systemPrompt: string
  temperature: AgentSettings["temperature"]
  tools?: ToolSet
}) => LLMConfig

type GenerateMasterPrompt = (params: {
  agent: Agent
  agentSettings: AgentSettings
  toolDescriptions?: Record<string, string>
  toolNames: string[]
}) => string

type BuildTools = (params: {
  agentSessionScope: AgentSessionScope
  includeSessionMetadataTools?: boolean
  includeSubAgentTools?: boolean
  onExecute: OnExecute
}) => Promise<BuiltTools>

export async function buildSubAgentTools({
  agentSubAgentsService,
  buildLLMConfig,
  buildTools,
  conversationAgentSessionsService,
  formAgentSessionsService,
  agentSettingsService,
  generateMasterPrompt,
  getProviderForModel,
  onExecute,
  projectsService,
  agentSessionScope,
}: {
  agentSessionScope: AgentSessionScope
  agentSubAgentsService: AgentSubAgentsService
  buildLLMConfig: BuildLLMConfig
  buildTools: BuildTools
  conversationAgentSessionsService: ConversationAgentSessionsService
  formAgentSessionsService: FormAgentSessionsService
  agentSettingsService: AgentSettingsService
  generateMasterPrompt: GenerateMasterPrompt
  getProviderForModel: (model: string) => LLMProvider
  onExecute: OnExecute
  projectsService: ProjectsService
}): Promise<{
  tools: ToolSet
  toolDescriptions: Record<string, string>
  hasSubAgentTools: boolean
}> {
  const { agent, connectScope } = agentSessionScope
  const hasAgentOrchestration = await projectsService.hasFeature({
    connectScope,
    feature: "agent-orchestration",
  })
  if (!hasAgentOrchestration) {
    return { tools: {}, toolDescriptions: {}, hasSubAgentTools: false }
  }

  const subAgents = await agentSubAgentsService.listSubAgents({
    connectScope,
    parentAgent: agent,
  })
  const tools: ToolSet = {}
  const toolDescriptions: Record<string, string> = {}

  for (const subAgent of subAgents) {
    if (!subAgent.enabled) continue
    if (subAgent.childAgent.type === "extraction") continue

    const description = subAgent.description
    tools[subAgent.toolName] = subAgentTool({
      description,
      toolName: subAgent.toolName,
      onExecute,
      execute: (input) =>
        runSubAgentTool({
          agentSessionScope,
          buildLLMConfig,
          buildTools,
          conversationAgentSessionsService,
          formAgentSessionsService,
          agentSettingsService,
          generateMasterPrompt,
          getProviderForModel,
          input,
          onExecute,
          subAgent,
        }),
    })
    toolDescriptions[subAgent.toolName] = description
  }

  return { tools, toolDescriptions, hasSubAgentTools: Object.keys(tools).length > 0 }
}

async function runSubAgentTool({
  agentSessionScope,
  buildLLMConfig,
  buildTools,
  conversationAgentSessionsService,
  formAgentSessionsService,
  agentSettingsService,
  generateMasterPrompt,
  getProviderForModel,
  input,
  onExecute,
  subAgent,
}: {
  agentSessionScope: AgentSessionScope
  buildLLMConfig: BuildLLMConfig
  buildTools: BuildTools
  conversationAgentSessionsService: ConversationAgentSessionsService
  formAgentSessionsService: FormAgentSessionsService
  agentSettingsService: AgentSettingsService
  generateMasterPrompt: GenerateMasterPrompt
  getProviderForModel: (model: string) => LLMProvider
  input: SubAgentToolInput
  onExecute: OnExecute
  subAgent: AgentSubAgent
}): Promise<Record<string, unknown>> {
  const childAgent = subAgent.childAgent
  if (childAgent.type === "extraction") {
    throw new Error(
      `Sub-agent "${childAgent.name}" (${childAgent.id}) is an extraction agent, which is not supported as a sub-agent.`,
    )
  }
  const childAgentSettings = await agentSettingsService.getLast({
    connectScope: agentSessionScope.connectScope,
    agentId: childAgent.id,
  })

  // Form and conversation sub-agents each get their own persistent sub-session,
  // keyed to the parent session. A form sub-agent needs it so the fillForm tool
  // can accumulate form state across parent turns; a conversation sub-agent uses
  // it for trace continuity. Other sub-agents reuse the parent session scope.
  let childSession: StreamingSession

  switch (childAgent.type) {
    case "form":
      childSession = await resolveFormSubSession({
        agentSessionScope,
        childAgent,
        formAgentSessionsService,
      })
      break
    case "conversation":
      childSession = await resolveConversationSubSession({
        agentSessionScope,
        childAgent,
        conversationAgentSessionsService,
      })
      break
  }

  const childScope: AgentSessionScope = {
    ...agentSessionScope,
    agent: childAgent,
    agentSettings: childAgentSettings,
    session: childSession,
  }

  // Dedicated trace id for the sub-agent run. A form or conversation sub-agent
  // reuses its persistent sub-session trace id (so all of its turns land in one
  // trace); any other sub-agent gets a fresh trace id per invocation.
  const subAgentTraceId = childSession.traceId

  // Surface a direct link to the sub-agent's own langfuse trace on the parent's
  // tool-call event. The AI SDK runs this tool inside an `ai.toolCall` span (the
  // span the langfuse exporter turns into the `ai.toolCall …` event); any
  // `ai.telemetry.metadata.*` attribute set on it is copied into that event's
  // metadata, giving a copyable pointer from the parent trace to the child's.
  trace
    .getActiveSpan()
    ?.setAttribute("ai.telemetry.metadata.subAgentTraceUrl", getTraceUrl(subAgentTraceId))

  const { tools, mcpClose, toolDescriptions } = await buildTools({
    agentSessionScope: childScope,
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
    const systemPrompt = generateMasterPrompt({
      agent: childAgent,
      agentSettings: childAgentSettings,
      toolNames,
      toolDescriptions,
    })

    const config = buildLLMConfig({
      systemPrompt,
      model: childAgentSettings.model,
      temperature: childAgentSettings.temperature,
      tools,
    })

    const metadata = buildSubAgentMetadata({
      childAgent,
      childAgentSettings,
      agentSessionScope,
      childSession,
      subAgentTraceId,
    })

    logger.log(
      `Sub-agent "${childAgent.name}" (${childAgent.id}) trace: ${getTraceUrl(subAgentTraceId)} ` +
        `(parent "${agentSessionScope.agent.name}" trace: ${getTraceUrl(agentSessionScope.session.traceId)})`,
    )

    // Run the sub-agent's LLM call inside a fresh OTEL root span so its spans get
    // their own OTEL trace id. The langfuse exporter groups by OTEL trace id and
    // writes each group under a single langfuse trace id — detaching here lets the
    // sub-agent's advertised trace id (subAgentTraceId) become its own trace
    // instead of collapsing into the parent's.
    return await tracer.startActiveSpan(
      `sub-agent ${childAgent.name}`,
      { root: true },
      async (rootSpan) => {
        try {
          const chunks = getProviderForModel(config.model).streamChatResponse({
            messages: [{ role: "user", content: buildSubAgentPrompt(input, childAgent) }],
            config,
            metadata,
          })

          let answer = ""
          for await (const chunk of chunks) answer += chunk
          return { answer }
        } finally {
          rootSpan.end()
        }
      },
    )
  } finally {
    await mcpClose?.()
  }
}

/**
 * Finds or creates the form session used when a parent agent delegates to a form
 * sub-agent. The session is keyed to the parent session so its state survives
 * across turns. Falls back to the parent session when the parent has no user
 * context (e.g. public sessions), where a user-scoped sub-session can't be made.
 */
async function resolveFormSubSession({
  agentSessionScope,
  childAgent,
  formAgentSessionsService,
}: {
  agentSessionScope: AgentSessionScope
  childAgent: Agent
  formAgentSessionsService: FormAgentSessionsService
}): Promise<StreamingSession> {
  const { connectScope, session: parentSession } = agentSessionScope
  if (!("userId" in parentSession) || !("type" in parentSession)) {
    return parentSession
  }

  return formAgentSessionsService.findOrCreateSubSession({
    connectScope,
    agentId: childAgent.id,
    userId: parentSession.userId,
    parentSessionId: parentSession.id,
    type: parentSession.type,
  })
}

/**
 * Finds or creates the conversation session used when a parent agent delegates
 * to a conversation sub-agent. The session is keyed to the parent session so the
 * sub-agent's runs land in one persistent trace across parent turns. Falls back
 * to the parent session when the parent has no user context (e.g. public
 * sessions), where a user-scoped sub-session can't be made.
 */
async function resolveConversationSubSession({
  agentSessionScope,
  childAgent,
  conversationAgentSessionsService,
}: {
  agentSessionScope: AgentSessionScope
  childAgent: Agent
  conversationAgentSessionsService: ConversationAgentSessionsService
}): Promise<StreamingSession> {
  const { connectScope, session: parentSession } = agentSessionScope
  if (!("userId" in parentSession) || !("type" in parentSession)) {
    return parentSession
  }

  return conversationAgentSessionsService.findOrCreateSubSession({
    connectScope,
    agentId: childAgent.id,
    userId: parentSession.userId,
    parentSessionId: parentSession.id,
    type: parentSession.type,
  })
}

/**
 * Builds the user-facing message handed to the sub-agent. The child agent's
 * master prompt is already supplied as the system prompt via the LLM config, so
 * this carries only the delegated task and any context the parent passed.
 */
function buildSubAgentPrompt(input: SubAgentToolInput, childAgent: Agent): string {
  const context = input.context.trim()
  const parts: (string | undefined)[] = [
    context ? `Conversation context:\n${context}` : undefined,
    `Delegated task:\n${input.task}`,
  ]

  switch (childAgent.type) {
    case "form":
      parts.push(
        [
          "The delegated task contains the user's latest answer(s).",
          "Use the fillForm tool to record any field values you can extract from that answer, then read the resulting form state.",
          "Reply to the parent assistant with:",
          "1. The current form state (the fields filled so far and their values).",
          "2. If the form is not complete, the single next question to ask the user for a still-missing field. If the form is complete, say so explicitly.",
        ].join("\n"),
      )
      break
    case "conversation":
      parts.push(
        "The delegated task is to respond to the user on behalf of the parent assistant. The sub-agent should reply with a direct answer that the parent assistant can use for the user. The sub-agent has access to its own tools and context.",
      )
      break
  }

  return parts.filter((part): part is string => part !== undefined).join("\n\n")
}

function buildSubAgentMetadata({
  childAgent,
  childAgentSettings,
  agentSessionScope,
  childSession,
  subAgentTraceId,
}: {
  agentSessionScope: AgentSessionScope
  childAgent: Agent
  childAgentSettings: AgentSettings
  childSession: StreamingSession
  subAgentTraceId: string
}): LLMMetadata {
  const {
    connectScope,
    agent: parentAgent,
    agentSettings: parentAgentSettings,
    session,
  } = agentSessionScope

  // The sub-agent runs inside a fresh OTEL root span (see runSubAgentTool), so its
  // spans get their own OTEL trace id and the exporter writes them under this
  // dedicated langfuse trace id rather than collapsing into the parent's trace.
  // It is grouped under the parent's langfuse session (`langfuseSessionId`) so the
  // parent and all its sub-agent traces share one session timeline, and a
  // `parent-trace:` tag links back to the parent run for navigation.
  return {
    traceId: subAgentTraceId,
    agentSessionId: childSession.id,
    langfuseSessionId: session.id,
    agentId: childAgent.id,
    revision: childAgentSettings.revision,
    projectId: childAgent.projectId,
    organizationId: session?.organizationId ?? connectScope.organizationId,
    currentTurn: session?.messages?.filter((message) => message.role === "user").length ?? 0,
    tags: [
      childAgent.name,
      `rev-${childAgentSettings.revision}`,
      childAgent.type,
      "sub-agent",
      `parent-${parentAgent.name}`,
      `parent-rev-${parentAgentSettings.revision}`,
      `parent-type-${parentAgent.type}`,
      `parent-trace:${session.traceId}`,
    ],
  }
}
