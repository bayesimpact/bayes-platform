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
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import type { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"
import type { AgentSubAgentsService } from "@/domains/agents/sub-agents/agent-sub-agents.service"
import type { ProjectsService } from "@/domains/projects/projects.service"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import { isLLMVisibleMessage } from "./llm-visible-message.helper"
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

  // Each sub-agent gets its own persistent sub-session, keyed to the parent
  // session: it carries trace continuity and, for fillForm-enabled sub-agents,
  // accumulates the form state (session.result) across parent turns.
  const childSession: StreamingSession = await resolveConversationSubSession({
    agentSessionScope,
    childAgent,
    conversationAgentSessionsService,
  })

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
          const recentConversation = buildRecentParentConversation(agentSessionScope.session)
          const chunks = getProviderForModel(config.model).streamChatResponse({
            messages: [
              {
                role: "user",
                content: buildSubAgentPrompt(input, childAgentSettings, recentConversation),
              },
            ],
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
 * Number of most-recent parent-session messages (user + assistant turns) surfaced
 * to a sub-agent. The parent LLM's paraphrased task/context is often too vague, so
 * the sub-agent also gets the verbatim tail of the real conversation to work from.
 */
const RECENT_PARENT_MESSAGE_LIMIT = 10

/**
 * Maximum characters of a single parent message reproduced in the sub-agent
 * transcript. Message content is unbounded (text column), so without a cap a
 * pasted document would be re-sent to the sub-agent on every delegation.
 */
const RECENT_PARENT_MESSAGE_MAX_LENGTH = 2_000

/**
 * Renders the tail of the parent conversation (the exchanges between the user and
 * the parent assistant) as a plain transcript, applying the same message
 * eligibility rules as the parent's own LLM history (isLLMVisibleMessage).
 * Returns undefined when there is nothing to show.
 */
function buildRecentParentConversation(session: StreamingSession): string | undefined {
  const turns = (session.messages ?? [])
    .filter(isLLMVisibleMessage)
    .slice(-RECENT_PARENT_MESSAGE_LIMIT)
    .map(
      (message) =>
        `${message.role === "user" ? "User" : "Parent assistant"}: ${truncateMessageContent(message.content)}`,
    )

  return turns.length > 0 ? turns.join("\n\n") : undefined
}

function truncateMessageContent(content: string): string {
  const trimmed = content.trim()
  return trimmed.length > RECENT_PARENT_MESSAGE_MAX_LENGTH
    ? `${trimmed.slice(0, RECENT_PARENT_MESSAGE_MAX_LENGTH)} […]`
    : trimmed
}

/**
 * Builds the user-facing message handed to the sub-agent. The child agent's
 * master prompt is already supplied as the system prompt via the LLM config, so
 * this carries only the recent parent conversation, the delegated task, and the
 * instructions matching the child agent's configuration.
 */
function buildSubAgentPrompt(
  input: SubAgentToolInput,
  childAgentSettings: AgentSettings,
  recentConversation: string | undefined,
): string {
  const sections: (string | undefined)[] = [
    recentConversation
      ? `## Recent conversation\n\nThe latest exchanges between the user and the parent assistant:\n\n${recentConversation}`
      : undefined,
    `## Delegated task\n\n${input.task}`,
    input.context ? `## Task's context\n\n${input.context}` : undefined,
    buildSubAgentInstructions(childAgentSettings),
  ]

  return sections.filter((section): section is string => section !== undefined).join("\n\n")
}

/**
 * Instructions appended to the sub-agent prompt, telling the child agent how to
 * act on the delegated task and what to reply to the parent. A fillForm-enabled
 * child is driven as a form filler; any other child answers conversationally.
 */
function buildSubAgentInstructions(childAgentSettings: AgentSettings): string {
  if (childAgentSettings.fillFormEnabled) {
    return [
      "## Instructions",
      "",
      "1. Use the `fillForm` tool to record any field values you can extract from that user's latest answer(s).",
      "2. Read the resulting form state.",
      "3. Reply to the parent assistant with the single next question needed to fill a missing field — or, if nothing is missing, state explicitly that the form is complete.",
    ].join("\n")
  }
  return [
    "## Instructions",
    "",
    "Respond to the user on behalf of the parent assistant. Reply with a direct answer that the parent assistant can relay to the user. You have access to your own tools and context.",
  ].join("\n")
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
