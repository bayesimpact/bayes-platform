import { DocumentsRagMode, ToolName } from "@caseai-connect/api-contracts"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type { ToolSet } from "ai"
import type {
  BuildLLMConfigParams,
  LLMConfig,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
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
import type { AgentSessionScope, OnExecute } from "./streaming-session.types"
import { type BuiltTools, buildSubAgentTools } from "./sub-agent-tools"
import { fillFormTool } from "./tools/fill-form.tool"
import { lookupKnowledgeBaseTool } from "./tools/lookup-knowledge-base.tool"
import {
  mandatoryTool,
  mandatoryToolExecutionCounts,
  mandatoryToolInstruction,
} from "./tools/mandatory.tool"
import { createRetrievedChunksRegistry } from "./tools/retrieved-chunks-registry"
import type { SessionStateTarget } from "./tools/session-state-target"
import { surfaceResourcesTool } from "./tools/surface-resources.tool"
import { createSurfacedResourcesRegistry } from "./tools/surfaced-resources-registry"

/**
 * Tools whose output the model never needs: they only log/notify (sources,
 * resource cards, session metadata). When a tool-loop step invokes only these,
 * the loop stops instead of paying an extra LLM generation for an empty
 * follow-up. Round-trip tools (lookup_knowledge_base, fillForm, MCP,
 * sub-agents) stay out of this list because the model consumes their output.
 */
const FIRE_AND_FORGET_TOOL_NAMES: string[] = [ToolName.SurfaceResources, ToolName.MandatoryTool]

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
          endOfTurnTools: {},
          hasSubAgentTools: false,
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
    session,
    onExecute,
  }: {
    agent: Agent
    session: AgentSessionScope["session"]
    onExecute: OnExecute
  }): Promise<McpToolset> {
    const closeFns: (() => Promise<void>)[] = []
    const tools: ToolSet = {}
    const toolDescriptions: Record<string, string> = {}
    const validatedAppResources = new Set<string>()
    // Headers, not prompt text: the server can attribute the call without
    // the model having to copy agent/session ids.
    const context: McpConversationContext = {
      agentId: agent.id,
      sessionId: session.id,
      externalVisitorId: "externalVisitorId" in session ? session.externalVisitorId : null,
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
    // fillForm needs a persisted session carrying a `result` column — public
    // streaming sessions (proxy, no DB row) can't accumulate form state.
    const hasFillFormTool =
      agentSettings.fillFormEnabled && agentSettings.outputJsonSchema != null && "result" in session
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
            })
          : Promise.resolve({ tools: {}, toolDescriptions: {} }),
      ])

    // chunkIds only make sense when the agent can actually retrieve chunks:
    // the sources part of the turn summary requires BOTH the project feature
    // flag and an active RAG mode (lookup tool present).
    const hasSourcesReporting =
      hasSourcesTool && agentSettings.documentsRagMode !== DocumentsRagMode.None
    // Every conversation agent submits a turn summary: suggestedTitle is
    // always reported; categories only when the agent has some configured;
    // chunkIds only per hasSourcesReporting. Sub-agents are excluded
    // (includeSessionMetadataTools=false) unless they report sources.
    const hasMandatoryToolTool = hasSourcesReporting || includeSessionMetadataTools

    // Shared between lookup (writer) and mandatory_tool (reader) within this
    // request: the report resolves the chunkIds cited by the model against
    // the chunks lookup actually retrieved.
    const retrievedChunksRegistry = createRetrievedChunksRegistry()

    // The end-of-turn report is declared in the answering loop (the model
    // can call it in the same generation as its answer — no extra call) AND
    // referenced in endOfTurnTools: the provider forces it after the answer
    // whenever the loop did not call it, so it runs on every turn no matter
    // what. The SAME tool instance backs both paths: its schema getters read
    // the chunks registry, so chunkIds only appears (in loop steps and in
    // the forced call alike) once a lookup registered chunks this turn.
    const endOfTurnTools: ToolSet = hasMandatoryToolTool
      ? {
          [ToolName.MandatoryTool]: mandatoryTool({
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
            onExecute,
          }),
        }
      : {}

    const tools: ToolSet = {
      // The end-of-turn report is callable from turn 1, like any other tool.
      ...endOfTurnTools,

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
              sessionResultUpdater:
                sessionState?.resultUpdater ?? this.conversationAgentSessionsService,
              onExecute,
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
          descriptions: { ...mcp.toolDescriptions, ...subAgentToolDescriptions },
          tools,
        }),
      },
      // Final section of the master prompt (recency): the response protocol
      // demanding the turn summary on every response.
      masterPromptEpilogue: hasMandatoryToolTool ? mandatoryToolInstruction() : undefined,
      fireAndForgetToolNames: FIRE_AND_FORGET_TOOL_NAMES.filter((toolName) => toolName in tools),
      endOfTurnTools,
      // A report submitted before the lookup registered chunks is stale for
      // the sources part: the forced end-of-turn retry must still run.
      endOfTurnExecutionCounts: hasSourcesReporting
        ? mandatoryToolExecutionCounts(retrievedChunksRegistry)
        : undefined,
      hasSubAgentTools: Object.keys(subAgentTools).length > 0,
    }
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
