import { DocumentsRagMode, ToolName } from "@caseai-connect/api-contracts"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type { ToolSet } from "ai"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  BuildLLMConfigParams,
  LLMConfig,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { ConversationFormsService } from "@/domains/agents/shared/conversation-forms/conversation-forms.service"
import { AgentSubAgentsService } from "@/domains/agents/sub-agents/agent-sub-agents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { type EnabledMcpServer, McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
import { ProjectsService } from "@/domains/projects/projects.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpClientService } from "@/external/mcp"
import { readMcpAppHtml } from "@/external/mcp/mcp-app-resource"
import { getMcpAppResourceUri } from "@/external/mcp/mcp-app-resource-uri"
import { applyMcpAppToolDescription } from "@/external/mcp/mcp-app-tool-description"
import type { McpSession } from "@/external/mcp/mcp-client.service"
import type { McpConversationContext } from "@/external/mcp/mcp-request-headers"
import { generateMasterPrompt } from "./master-promts/generate-master-prompt"
import { promptHelpers } from "./master-promts/helpers"
import type { AgentSessionScope, OnExecute, StreamingSession } from "./streaming-session.types"
import { sessionPersistsForms } from "./streaming-session.types"
import { type BuiltTools, buildSubAgentTools } from "./sub-agent-tools"
import { concludeHandoffInstruction, concludeHandoffTool } from "./tools/conclude-handoff.tool"
import { fillFormTool } from "./tools/fill-form.tool"
import {
  inlineCitationInstruction,
  lookupKnowledgeBaseTool,
} from "./tools/lookup-knowledge-base.tool"
import { createRetrievedChunksRegistry } from "./tools/retrieved-chunks-registry"
import type { SessionStateTarget } from "./tools/session-state-target"
import { surfaceResourcesTool } from "./tools/surface-resources.tool"
import { createSurfacedResourcesRegistry } from "./tools/surfaced-resources-registry"
import type { TurnClassificationContext } from "./tools/turn-classification"

/**
 * Tools whose output the model never needs: they only log/notify (resource
 * cards). When a tool-loop step invokes only these, the loop stops instead
 * of paying an extra LLM generation for an empty follow-up. Round-trip tools
 * (lookup_knowledge_base, fillForm, MCP, sub-agents) stay out of this list
 * because the model consumes their output.
 */
const FIRE_AND_FORGET_TOOL_NAMES: string[] = [ToolName.SurfaceResources]

/**
 * The tools exposed by an agent's enabled MCP servers
 */
type McpToolset = {
  // A function that tears down every open MCP session. If no MCP sessions were opened, this will be undefined.
  disconnect: (() => Promise<void>) | undefined
  // The tools exposed by the agent's enabled MCP servers.
  tools: ToolSet
  // Descriptions for the tools exposed by the agent's enabled MCP servers.
  toolDescriptions: Record<string, string>
}
type BuildToolsParams = {
  agentSessionScope: AgentSessionScope
  getProviderForModel: (model: string) => LLMProvider
  buildLLMConfig: (params: BuildLLMConfigParams) => LLMConfig
  onExecute: OnExecute
  includeSessionMetadataTools?: boolean
  includeSubAgentTools?: boolean
  /** Overrides where stateful tools persist (public sessions). */
  sessionState?: SessionStateTarget
}

/**
 * Builds the tool sets exposed to the LLM for a given agent.
 *
 * Owns everything related to tools: MCP tool wiring, conversation agent
 * tools, sub-agent tools, and the helpers that merge and filter them. Extracted
 * from StreamingLLMService so that service can focus on the streaming lifecycle.
 */
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name)

  constructor(
    @Inject(ConversationAgentSessionsService)
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    @Inject(ConversationFormsService)
    private readonly conversationFormsService: ConversationFormsService,
    @Inject(AgentSubAgentsService)
    private readonly agentSubAgentsService: AgentSubAgentsService,
    @Inject(AgentSettingsService)
    private readonly agentSettingsService: AgentSettingsService,
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,

    private readonly documentChunkRetrievalService: DocumentChunkRetrievalService,
    private readonly mcpClientService: McpClientService,
    private readonly mcpServersService: McpServersService,
  ) {}

  buildTools: (params: BuildToolsParams) => Promise<BuiltTools> = async (params) => {
    return this.buildToolsImpl(params)
  }

  private async buildToolsImpl({
    agentSessionScope,
    getProviderForModel,
    buildLLMConfig,
    onExecute,
    includeSessionMetadataTools = true,
    includeSubAgentTools = true,
    sessionState,
  }: BuildToolsParams): Promise<BuiltTools> {
    const { agent } = agentSessionScope
    const mcp = await this.buildMcpTools({
      agent,
      locale: agentSessionScope.agentSettings.locale,
      session: agentSessionScope.session,
      onExecute,
    })

    switch (agent.type) {
      case "conversation":
        return this.buildConversationAgentTools({
          agentSessionScope,
          includeSessionMetadataTools,
          includeSubAgentTools,
          mcp,
          getProviderForModel,
          buildLLMConfig,
          onExecute,
          sessionState,
        })

      default:
        return {
          mcpClose: mcp.disconnect,
          toolDescriptions: {},
          tools: undefined,
          fireAndForgetToolNames: [],
          hasSubAgentTools: false,
          promptSections: [],
        }
    }
  }

  /**
   * Connects to each enabled MCP server and exposes its tools to the model.
   * MCP App HTML is not kept here: a successful call only stores the `ui://`
   * pointer, and McpAppHtmlService re-reads the card when messages are loaded.
   */
  private async buildMcpTools({
    agent,
    locale,
    session,
    onExecute,
  }: {
    agent: Agent
    /** Language of the settings revision being run, so servers can answer in it. */
    locale: string
    session: AgentSessionScope["session"]
    onExecute: OnExecute
  }): Promise<McpToolset> {
    const closeFns: (() => Promise<void>)[] = []
    const tools: ToolSet = {}
    const toolDescriptions: Record<string, string> = {}
    const validatedAppResources = new Set<string>()
    // Headers, not prompt text: the server can attribute the call and pick its
    // language without the model having to copy agent/session ids or a locale.
    const context: McpConversationContext = {
      agentId: agent.id,
      sessionId: session.id,
      externalVisitorId: "externalVisitorId" in session ? session.externalVisitorId : null,
      locale,
    }

    for (const server of await this.mcpServersService.getEnabledServersForAgent(agent.id)) {
      const mcpSession = await this.mcpClientService.connect({ ...server, context })
      closeFns.push(mcpSession.close)
      this.addMcpServerTools({
        mcpSession,
        onExecute,
        server,
        toolDescriptions,
        tools,
        validatedAppResources,
      })
    }

    return {
      disconnect:
        closeFns.length > 0
          ? async () => {
              for (const closeFn of closeFns) await closeFn()
            }
          : undefined,
      tools,
      toolDescriptions,
    }
  }

  private addMcpServerTools({
    mcpSession,
    onExecute,
    server,
    toolDescriptions,
    tools,
    validatedAppResources,
  }: {
    mcpSession: McpSession
    onExecute: OnExecute
    server: EnabledMcpServer
    toolDescriptions: Record<string, string>
    tools: ToolSet
    validatedAppResources: Set<string>
  }) {
    for (const [toolName, toolDef] of Object.entries(mcpSession.tools)) {
      const originalExecute = toolDef.execute
      if (!originalExecute) continue

      const resourceUri = getMcpAppResourceUri(toolDef)
      const description = this.mcpToolDescription(toolDef, resourceUri)
      if (description) toolDescriptions[toolName] = description
      if (resourceUri) {
        this.logger.log("MCP App resource discovered", {
          mcpServerId: server.id,
          resourceUri,
          toolName,
        })
      }

      tools[toolName] = {
        ...toolDef,
        ...(description ? { description } : {}),
        execute: this.wrapMcpExecute({
          mcpSession,
          onExecute,
          originalExecute,
          resourceUri,
          server,
          toolName,
          validatedAppResources,
        }),
      }
    }
  }

  /**
   * Logs the call, then persists a tool row. MCP App tools also get a pointer
   * (`mcpServerId` + `ui://`) once the declared resource validates; ordinary
   * MCP tools do not store `result`, to avoid extra PHI on the message.
   */
  private wrapMcpExecute({
    mcpSession,
    onExecute,
    originalExecute,
    resourceUri,
    server,
    toolName,
    validatedAppResources,
  }: {
    mcpSession: McpSession
    onExecute: OnExecute
    originalExecute: NonNullable<ToolSet[string]["execute"]>
    resourceUri: string | undefined
    server: EnabledMcpServer
    toolName: string
    validatedAppResources: Set<string>
  }): NonNullable<ToolSet[string]["execute"]> {
    return (async (...executeArgs: Parameters<typeof originalExecute>) => {
      this.logger.log(`[MCP] Calling tool "${toolName}"`)
      const toolArguments = (executeArgs[0] ?? {}) as Record<string, unknown>
      try {
        const result = await originalExecute(...executeArgs)
        this.logger.log(`[MCP] Tool "${toolName}" succeeded`)
        const mcpApp = await this.mcpAppAfterSuccess({
          mcpSession,
          resourceUri,
          server,
          toolName,
          validatedAppResources,
        })
        await onExecute({
          arguments: toolArguments,
          mcpApp,
          result: mcpApp ? result : undefined,
          toolName,
        })
        return result
      } catch (error) {
        this.logger.error(`[MCP] Tool "${toolName}" failed: ${error}`)
        await onExecute({ arguments: toolArguments, toolName })
        throw error
      }
    }) as typeof originalExecute
  }

  /**
   * After a successful MCP call, tag MCP App tools with a `ui://` pointer only
   * if that resource actually reads as an MCP App. Ordinary tools get no
   * pointer. HTML is discarded; McpAppHtmlService loads the current card later.
   */
  private async mcpAppAfterSuccess({
    mcpSession,
    resourceUri,
    server,
    toolName,
    validatedAppResources,
  }: {
    mcpSession: McpSession
    resourceUri: string | undefined
    server: EnabledMcpServer
    toolName: string
    validatedAppResources: Set<string>
  }) {
    if (!resourceUri) return undefined
    const isValid = await this.isValidMcpAppResource({
      mcpSession,
      mcpServerId: server.id,
      resourceUri,
      toolName,
      validatedAppResources,
    })
    return isValid ? { mcpServerId: server.id, resourceUri } : undefined
  }

  /**
   * Prove the declared `ui://` is a real MCP App before tagging the tool call.
   */
  private async isValidMcpAppResource({
    mcpSession,
    mcpServerId,
    resourceUri,
    toolName,
    validatedAppResources,
  }: {
    mcpSession: McpSession
    mcpServerId: string
    resourceUri: string
    toolName: string
    validatedAppResources: Set<string>
  }): Promise<boolean> {
    const cacheKey = `${mcpServerId}:${resourceUri}`
    if (validatedAppResources.has(cacheKey)) return true

    try {
      readMcpAppHtml({
        resource: await mcpSession.readResource(resourceUri),
        resourceUri,
      })
      validatedAppResources.add(cacheKey)
      this.logger.log("MCP App resource read", { mcpServerId, resourceUri, toolName })
      return true
    } catch (error) {
      this.logger.warn("MCP App resource read failed", {
        error: error instanceof Error ? error.message : String(error),
        mcpServerId,
        resourceUri,
        toolName,
      })
      return false
    }
  }

  private mcpToolDescription(
    toolDef: unknown,
    resourceUri: string | undefined,
  ): string | undefined {
    const description = this.getToolDescription(toolDef)
    return resourceUri ? applyMcpAppToolDescription(description) : description
  }

  private async buildConversationAgentTools({
    agentSessionScope,
    includeSessionMetadataTools,
    includeSubAgentTools,
    mcp,
    getProviderForModel,
    buildLLMConfig,
    onExecute,
    sessionState,
  }: {
    agentSessionScope: AgentSessionScope
    includeSessionMetadataTools: boolean
    includeSubAgentTools: boolean
    mcp: McpToolset
    getProviderForModel: (model: string) => LLMProvider
    buildLLMConfig: (params: BuildLLMConfigParams) => LLMConfig
    onExecute: OnExecute
    sessionState?: SessionStateTarget
  }): Promise<BuiltTools> {
    const { agent, agentSettings, connectScope, session } = agentSessionScope
    // fillForm needs a session row for its form to attach to: evaluation runs
    // have none and get no fillForm tool.
    const hasFillFormTool =
      agentSettings.fillFormEnabled &&
      agentSettings.outputJsonSchema != null &&
      sessionPersistsForms(session)
    const [hasSourcesTool, { tools: subAgentTools, toolDescriptions: subAgentToolDescriptions }] =
      await Promise.all([
        // Check if the agent has the sources tool enabled
        this.projectsService.hasFeature({ connectScope, feature: "sources-tool" }),

        // Build sub-agent tools if requested
        includeSubAgentTools
          ? buildSubAgentTools({
              agentSessionScope,
              agentSubAgentsService: this.agentSubAgentsService,
              buildLLMConfig,
              buildTools: this.buildTools,
              conversationAgentSessionsService: this.conversationAgentSessionsService,
              agentSettingsService: this.agentSettingsService,
              generateMasterPrompt,
              getProviderForModel,
              onExecute,
              projectsService: this.projectsService,
              activeAgentController:
                sessionState?.activeAgent ?? this.conversationAgentSessionsService,
              formReader: this.conversationFormsService,
            })
          : Promise.resolve({ tools: {}, toolDescriptions: {} }),
      ])
    // A sub-agent answering as the active agent of a handoff hands the
    // conversation back itself, with this tool; the post-turn step also reads
    // its reply for a conclusion it forgot to signal, and summarizes its part.
    const handoff = agentSessionScope.handoff
    const handoffTurnState = { concludedByTool: false }
    const activeAgentController = sessionState?.activeAgent ?? this.conversationAgentSessionsService
    const concludeHandoffFromClassifier = handoff
      ? async ({
          summary,
          detectedByClassifier,
        }: {
          summary: string
          detectedByClassifier: boolean
        }) => {
          if (detectedByClassifier) {
            await activeAgentController.clearActiveAgentIfCurrent({
              connectScope,
              sessionId: session.id,
              expectedActiveAgentId: agent.id,
            })
            await onExecute({
              toolName: ToolName.ConcludeHandoff,
              arguments: { detectedByClassifier: true, summary },
            })
          }
          await this.conversationFormsService.conclude({
            connectScope,
            sessionId: session.id,
            agentId: agent.id,
            agentSettingsId: agentSettings.id,
            summary: summary || undefined,
          })
        }
      : undefined
    const promptSections = await this.buildConversationContextSections({
      connectScope,
      agent,
      session,
      handoff,
    })

    // Sources are reported only when the agent can actually retrieve chunks:
    // BOTH the project feature flag and an active RAG mode (lookup tool present).
    const hasSourcesReporting =
      hasSourcesTool && agentSettings.documentsRagMode !== DocumentsRagMode.None

    // Written by the lookup tool, read after the turn: the inline citations
    // (and the classifier's fallback attribution) resolve the aliases the
    // model cited against the chunks the lookup actually retrieved.
    const retrievedChunksRegistry = createRetrievedChunksRegistry()

    // Everything the platform records ABOUT the reply (title, categories,
    // sources) is computed after the turn, not by a tool in the loop (see
    // turn-classification.ts). Sub-agents and evaluation runs pass
    // includeSessionMetadataTools=false: no session of their own to title.
    const turnClassification: TurnClassificationContext | undefined =
      hasSourcesReporting || includeSessionMetadataTools || handoff
        ? {
            retrievedChunksRegistry: hasSourcesReporting ? retrievedChunksRegistry : undefined,
            sessionMetadata: includeSessionMetadataTools
              ? {
                  connectScope,
                  sessionId: session.id,
                  availableCategoryNames: (agent.sessionCategories ?? [])
                    .map((agentSessionCategory) => agentSessionCategory.name)
                    .sort((leftCategoryName, rightCategoryName) =>
                      leftCategoryName.localeCompare(rightCategoryName),
                    ),
                  metadataRecalculator:
                    sessionState?.metadataRecalculator ?? this.conversationAgentSessionsService,
                }
              : undefined,
            handoff:
              handoff && concludeHandoffFromClassifier
                ? {
                    childAgentName: agent.name,
                    parentAgentName: handoff.parentAgent.name,
                    concludedByTool: () => handoffTurnState.concludedByTool,
                    conclude: concludeHandoffFromClassifier,
                  }
                : undefined,
            onExecute,
          }
        : undefined

    const tools: ToolSet = {
      // Add the document retrieval tool if the agent has a RAG mode enabled
      ...(agentSettings.documentsRagMode === DocumentsRagMode.None
        ? {}
        : {
            [ToolName.LookupKnowledgeBase]: lookupKnowledgeBaseTool({
              connectScope,
              documentTagIds:
                agentSettings.documentsRagMode === DocumentsRagMode.Tags
                  ? (agent.documentTags?.map((documentTag) => documentTag.id) ?? [])
                  : [],
              retrievalService: this.documentChunkRetrievalService,
              retrievedChunksRegistry,
              citeInline: hasSourcesReporting,
              onExecute,
            }),
          }),

      // Add the surface resources tool if the agent has any resource libraries.
      // The registry resolves the prompt aliases (r1, r2...) back to real
      // resources server-side — same pattern as the chunks registry.
      ...((agent.resourceLibraries?.length ?? 0) > 0
        ? {
            [ToolName.SurfaceResources]: surfaceResourcesTool({
              surfacedResourcesRegistry: createSurfacedResourcesRegistry(
                agent.resourceLibraries ?? [],
              ),
              onExecute,
            }),
          }
        : {}),

      // Add the fillForm tool if the agent has it enabled (with a form definition)
      ...(hasFillFormTool
        ? {
            [ToolName.FillForm]: fillFormTool({
              agentSessionScope,
              conversationFormStore: this.conversationFormsService,
              onExecute,
            }),
          }
        : {}),

      ...(handoff
        ? {
            [ToolName.ConcludeHandoff]: concludeHandoffTool({
              connectScope,
              sessionId: session.id,
              childAgentId: agent.id,
              activeAgentController,
              formConcluder: this.conversationFormsService,
              onExecute,
              onConcluded: () => {
                handoffTurnState.concludedByTool = true
              },
            }),
          }
        : {}),
    }

    // Merge the MCP tools into the final tool set
    this.addToolsWithoutCollisions({ target: tools, source: mcp.tools, sourceLabel: "MCP" })

    // Merge the sub-agent tools into the final tool set
    this.addToolsWithoutCollisions({
      target: tools,
      source: subAgentTools,
      sourceLabel: "sub-agent",
    })

    return {
      mcpClose: mcp.disconnect,
      tools,
      toolDescriptions: {
        ...this.filterToolDescriptions({
          descriptions: {
            ...mcp.toolDescriptions,
            ...subAgentToolDescriptions,
            // The master prompt repeats the citation rule on the lookup line
            // (see promptHelpers.tools) when sources are reported.
            ...(hasSourcesReporting
              ? { [ToolName.LookupKnowledgeBase]: inlineCitationInstruction() }
              : {}),
            ...(handoff
              ? { [ToolName.ConcludeHandoff]: concludeHandoffInstruction(handoff.parentAgent.name) }
              : {}),
          },
          tools,
        }),
      },
      fireAndForgetToolNames: FIRE_AND_FORGET_TOOL_NAMES.filter((toolName) => toolName in tools),
      turnClassification,
      hasSubAgentTools: Object.keys(subAgentTools).length > 0,
      promptSections,
    }
  }

  /**
   * Prompt sections built from the conversation's forms. The session's agent
   * sees what its handoff sub-agents collected and whether they concluded; a
   * sub-agent in control sees what other agents already collected, so the
   * user is not asked twice. Nothing here for a session without forms.
   */
  private async buildConversationContextSections({
    connectScope,
    agent,
    session,
    handoff,
  }: {
    connectScope: RequiredConnectScope
    agent: Agent
    session: StreamingSession
    handoff: AgentSessionScope["handoff"]
  }): Promise<string[]> {
    if (!sessionPersistsForms(session)) return []
    const forms = await this.conversationFormsService.listForSession({
      connectScope,
      sessionId: session.id,
      withAgent: true,
    })
    if (forms.length === 0) return []

    if (handoff) {
      const facts = forms
        .filter((form) => form.agentId !== agent.id && Object.keys(form.state).length > 0)
        .map((form) => ({ agentName: form.agent?.name ?? "another agent", state: form.state }))
      return [promptHelpers.knownFacts(facts)].filter(Boolean)
    }

    // Only the sub-agents that take the conversation over write forms in this
    // session; a relay sub-agent's form lives in its own sub-session and its
    // exchanges are already in the transcript. An embed session has no
    // sub-session, so a relay child's form can sit here too: it is left out.
    const subAgents = await this.agentSubAgentsService.listSubAgents({
      connectScope,
      parentAgent: agent,
    })
    const handoffChildIds = new Set(
      subAgents
        .filter((subAgent) => subAgent.mode === "handoff" && subAgent.enabled)
        .map((subAgent) => subAgent.childAgentId),
    )
    const outcomes = forms
      .filter((form) => form.agentId !== agent.id && handoffChildIds.has(form.agentId))
      .map((form) => ({
        agentName: form.agent?.name ?? "a sub-agent",
        status: form.status,
        state: form.state,
        summary: form.summary,
      }))
    return [promptHelpers.subAgentOutcomes(outcomes)].filter(Boolean)
  }

  private addToolsWithoutCollisions({
    source,
    sourceLabel,
    target,
  }: {
    source: ToolSet
    sourceLabel: string
    target: ToolSet
  }) {
    for (const [toolName, toolDef] of Object.entries(source)) {
      if (target[toolName]) {
        this.logger.warn(
          `Skipping ${sourceLabel} tool "${toolName}" because another tool with the same name is already registered.`,
        )
        continue
      }
      target[toolName] = toolDef
    }
  }

  private filterToolDescriptions({
    descriptions,
    tools,
  }: {
    descriptions: Record<string, string>
    tools: ToolSet | undefined
  }): Record<string, string> {
    if (!tools) return {}

    return Object.fromEntries(
      Object.keys(tools)
        .map((toolName) => [toolName, descriptions[toolName]] as const)
        .filter((entry): entry is readonly [string, string] => entry[1] !== undefined),
    )
  }

  private getToolDescription(toolDef: unknown): string | undefined {
    if (!toolDef || typeof toolDef !== "object" || !("description" in toolDef)) {
      return undefined
    }

    const description = (toolDef as { description?: unknown }).description
    return typeof description === "string" && description.trim().length > 0
      ? description
      : undefined
  }
}
