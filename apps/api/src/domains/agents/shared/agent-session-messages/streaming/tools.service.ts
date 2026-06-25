import { DocumentsRagMode, ToolName } from "@caseai-connect/api-contracts"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type { ToolSet } from "ai"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import { FormAgentSessionsService } from "@/domains/agents/form-agent-sessions/form-agent-sessions.service"
import { AgentSubAgentsService } from "@/domains/agents/sub-agents/agent-sub-agents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
import { ProjectsService } from "@/domains/projects/projects.service"
import { ServiceWithLLM } from "@/external/llm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpClientService } from "@/external/mcp"
import { generateMasterPrompt } from "./master-promts/generate-master-prompt"
import type { AgentSessionScope, OnExecute } from "./streaming-session.types"
import { type BuiltTools, buildSubAgentTools } from "./sub-agent-tools"
import { fillFormTool } from "./tools/fill-form.tool"
import { recalculateConversationSessionMetadataTool } from "./tools/recalculate-conversation-session-metadata.tool"
import { retrieveProjectDocumentChunksTool } from "./tools/retrieve-project-document-chunks.tool"
import { sourcesTool } from "./tools/sources.tool"
import { surfaceResourcesTool } from "./tools/surface-resources.tool"

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

/**
 * Builds the tool sets exposed to the LLM for a given agent.
 *
 * Owns everything related to tools: MCP tool wiring, conversation/form agent
 * tools, sub-agent tools, and the helpers that merge and filter them. Extracted
 * from StreamingService so that service can focus on the streaming lifecycle.
 */
@Injectable()
export class ToolsService extends ServiceWithLLM {
  private readonly logger = new Logger(ToolsService.name)

  constructor(
    @Inject(FormAgentSessionsService)
    private readonly formAgentSessionsService: FormAgentSessionsService,
    @Inject(ConversationAgentSessionsService)
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    @Inject(AgentSubAgentsService)
    private readonly agentSubAgentsService: AgentSubAgentsService,
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,

    private readonly documentChunkRetrievalService: DocumentChunkRetrievalService,
    private readonly mcpClientService: McpClientService,
    private readonly mcpServersService: McpServersService,

    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({ mockLlmProvider, vertexLlmProvider, medGemmaLlmProvider, gemmaLlmProvider })
  }

  async buildTools({
    agentSessionScope,
    onExecute,
    includeSessionMetadataTools = true,
    includeSubAgentTools = true,
  }: {
    agentSessionScope: AgentSessionScope
    onExecute: OnExecute
    includeSessionMetadataTools?: boolean
    includeSubAgentTools?: boolean
  }): Promise<BuiltTools> {
    const { agent } = agentSessionScope
    const mcp = await this.buildMcpTools({ agent, onExecute })

    switch (agent.type) {
      case "conversation":
        return this.buildConversationAgentTools({
          agentSessionScope,
          includeSessionMetadataTools,
          includeSubAgentTools,
          mcp,
          onExecute,
        })

      case "form":
        return this.buildFormAgentTools({ agentSessionScope, mcp, onExecute })

      default:
        return {
          mcpClose: mcp.disconnect,
          toolDescriptions: {},
          tools: undefined,
          hasSubAgentTools: false,
        }
    }
  }

  private async buildMcpTools({
    agent,
    onExecute,
  }: {
    agent: Agent
    onExecute: OnExecute
  }): Promise<McpToolset> {
    const mcpCloseFns: (() => Promise<void>)[] = []
    const mcpTools: ToolSet = {}
    const mcpToolDescriptions: Record<string, string> = {}

    const serverConfigs = await this.mcpServersService.getEnabledServersForAgent(agent.id)
    for (const serverConfig of serverConfigs) {
      const mcpSession = await this.mcpClientService.connect(serverConfig)
      mcpCloseFns.push(mcpSession.close)
      for (const [toolName, toolDef] of Object.entries(mcpSession.tools)) {
        const originalExecute = toolDef.execute
        if (!originalExecute) continue
        const description = this.getToolDescription(toolDef)
        if (description) mcpToolDescriptions[toolName] = description
        mcpTools[toolName] = {
          ...toolDef,
          execute: (async (...executeArgs: Parameters<typeof originalExecute>) => {
            this.logger.log(
              `[MCP] Calling tool "${toolName}" with args: ${JSON.stringify(executeArgs[0])}`,
            )
            onExecute({
              toolName,
              arguments: (executeArgs[0] ?? {}) as Record<string, unknown>,
            })
            try {
              const result = await originalExecute(...executeArgs)
              this.logger.log(`[MCP] Tool "${toolName}" returned: ${JSON.stringify(result)}`)
              return result
            } catch (error) {
              this.logger.error(`[MCP] Tool "${toolName}" failed: ${error}`)
              throw error
            }
          }) as typeof originalExecute,
        }
      }
    }

    const disconnect =
      mcpCloseFns.length > 0
        ? async () => {
            for (const closeFn of mcpCloseFns) await closeFn()
          }
        : undefined

    return { disconnect, tools: mcpTools, toolDescriptions: mcpToolDescriptions }
  }

  private async buildConversationAgentTools({
    agentSessionScope,
    includeSessionMetadataTools,
    includeSubAgentTools,
    mcp,
    onExecute,
  }: {
    agentSessionScope: AgentSessionScope
    includeSessionMetadataTools: boolean
    includeSubAgentTools: boolean
    mcp: McpToolset
    onExecute: OnExecute
  }): Promise<BuiltTools> {
    const { agent, connectScope, session } = agentSessionScope
    const [
      hasSourcesTool,
      currentCategoryNames,
      { tools: subAgentTools, toolDescriptions: subAgentToolDescriptions },
    ] = await Promise.all([
      // Check if the agent has the sources tool enabled
      this.projectsService.hasFeature({ connectScope, feature: "sources-tool" }),

      // Get the current category names for the session if requested and if the agent has session categories
      includeSessionMetadataTools && (agent.sessionCategories?.length ?? 0) > 0
        ? this.conversationAgentSessionsService.getCurrentCategoryNamesForSession({
            connectScope,
            sessionId: session.id,
          })
        : Promise.resolve([]),

      // Build sub-agent tools if requested
      includeSubAgentTools
        ? buildSubAgentTools({
            agentSessionScope,
            agentSubAgentsService: this.agentSubAgentsService,
            buildLLMConfig: (params) => this.buildLLMConfig(params),
            buildTools: (params) => this.buildTools(params),
            conversationAgentSessionsService: this.conversationAgentSessionsService,
            formAgentSessionsService: this.formAgentSessionsService,
            generateMasterPrompt,
            getProviderForModel: (model) => this.getProviderForModel(model),
            onExecute,
            projectsService: this.projectsService,
          })
        : Promise.resolve({ tools: {}, toolDescriptions: {} }),
    ])

    const hasRecalculateConversationSessionMetadataTool =
      includeSessionMetadataTools && (agent.sessionCategories?.length ?? 0) > 0

    const tools: ToolSet = {
      // Add the document retrieval tool if the agent has a RAG mode enabled
      ...(agent.documentsRagMode === DocumentsRagMode.None
        ? {}
        : {
            [ToolName.RetrieveProjectDocumentChunks]: retrieveProjectDocumentChunksTool({
              connectScope,
              documentTagIds:
                agent.documentsRagMode === DocumentsRagMode.Tags
                  ? (agent.documentTags?.map((documentTag) => documentTag.id) ?? [])
                  : [],
              retrievalService: this.documentChunkRetrievalService,
              onExecute,
            }),
          }),

      // Add the sources tool if the agent has the sources tool feature enabled
      ...(hasSourcesTool ? { [ToolName.Sources]: sourcesTool({ onExecute }) } : {}),

      // Add the surface resources tool if the agent has any resource libraries
      ...((agent.resourceLibraries?.length ?? 0) > 0
        ? { [ToolName.SurfaceResources]: surfaceResourcesTool({ onExecute }) }
        : {}),

      // Add the recalculate conversation session metadata tool if the agent has session categories and the feature is enabled
      ...(hasRecalculateConversationSessionMetadataTool
        ? {
            [ToolName.RecalculateConversationSessionMetadata]:
              recalculateConversationSessionMetadataTool({
                connectScope,
                sessionId: agentSessionScope.session.id,
                availableCategoryNames: (agent.sessionCategories ?? [])
                  .map((agentSessionCategory) => agentSessionCategory.name)
                  .sort((leftCategoryName, rightCategoryName) =>
                    leftCategoryName.localeCompare(rightCategoryName),
                  ),
                currentCategoryNames,
                conversationAgentSessionsService: this.conversationAgentSessionsService,
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
      toolDescriptions: this.filterToolDescriptions({
        descriptions: { ...mcp.toolDescriptions, ...subAgentToolDescriptions },
        tools,
      }),
      hasSubAgentTools: Object.keys(subAgentTools).length > 0,
    }
  }

  private buildFormAgentTools({
    agentSessionScope,
    mcp,
    onExecute,
  }: {
    agentSessionScope: AgentSessionScope
    mcp: McpToolset
    onExecute: OnExecute
  }): BuiltTools {
    const { agent } = agentSessionScope
    return {
      mcpClose: mcp.disconnect,
      toolDescriptions: {},
      tools: {
        [ToolName.FillForm]: fillFormTool({
          agentSessionScope,
          formAgentSessionsService: this.formAgentSessionsService,
          onExecute,
        }),
        ...((agent.resourceLibraries?.length ?? 0) > 0
          ? { [ToolName.SurfaceResources]: surfaceResourcesTool({ onExecute }) }
          : {}),
      } as ToolSet,
      hasSubAgentTools: false,
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
