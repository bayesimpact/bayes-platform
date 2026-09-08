import { Inject, Injectable, Logger } from "@nestjs/common"
import { v4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
// biome-ignore lint/style/useImportType: required for DI
import { AgentLlmRequestService } from "@/domains/agents/shared/agent-session-messages/streaming/agent-llm-request.service"
import type { PublicStreamingSessionProxy } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-session.types"
import { LlmServiceBase } from "@/external/llm"

@Injectable()
export class EvaluationConversationRunLlmService extends LlmServiceBase {
  private readonly logger = new Logger(EvaluationConversationRunLlmService.name)

  constructor(
    private readonly agentLlmRequestService: AgentLlmRequestService,
    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("Vertex3LLMProvider")
    vertex3LlmProvider: LLMProvider,
    @Inject("MistralLLMProvider")
    mistralLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({
      mockLlmProvider,
      vertexLlmProvider,
      vertex3LlmProvider,
      medGemmaLlmProvider,
      gemmaLlmProvider,
      mistralLlmProvider,
    })
  }
  /**
   * Runs a single user turn against an agent without a persisted session, using
   * the exact same request building (tools, master prompt, streaming provider
   * call) as Studio. Used by evaluation runs so the evaluated agent behaves
   * exactly like the Studio one.
   *
   * The only divergence from Studio: session-metadata tools are excluded because
   * there is no session row for them to mutate.
   */
  async runSingleTurn({
    agent,
    agentSettings,
    connectScope,
    userContent,
    extraTags,
  }: {
    agent: Agent
    agentSettings: AgentSettings
    connectScope: RequiredConnectScope
    userContent: string
    extraTags?: string[]
  }): Promise<{ output: string; traceId: string }> {
    const traceId = v4()
    const userMessage = { role: "user", content: userContent, status: null } as AgentMessage
    const session: PublicStreamingSessionProxy = {
      id: traceId,
      traceId,
      organizationId: connectScope.organizationId,
      messages: [userMessage],
    }

    const { config, metadata, messages, mcpClose } =
      await this.agentLlmRequestService.buildLLMRequest({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        includeSessionMetadataTools: false,
        extraTags,
        onToolExecute: (toolExecution) => {
          this.logger.log(
            `Tool "${toolExecution.toolName}" executed during single-turn run (trace ${traceId})`,
          )
        },
        getProviderForModel: this.getProviderForModel,
        buildLLMConfig: this.buildLLMConfig,
      })

    try {
      let output = ""
      const chunks = this.getProviderForModel(config.model).streamChatResponse({
        messages,
        config,
        metadata,
      })
      for await (const chunk of chunks) {
        output += chunk
      }
      return { output, traceId }
    } finally {
      await mcpClose?.()
    }
  }
}
