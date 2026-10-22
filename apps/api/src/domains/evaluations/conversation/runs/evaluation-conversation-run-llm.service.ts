import { Inject, Injectable, Logger } from "@nestjs/common"
import { v4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
// biome-ignore lint/style/useImportType: required for DI
import { AgentLlmRequestService } from "@/domains/agents/shared/agent-session-messages/streaming/agent-llm-request.service"
import type { PublicStreamingSessionProxy } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-session.types"
import { LlmServiceBase } from "@/external/llm"
import { LLM_PROVIDERS, type LlmProviders } from "@/external/llm/llm.module"

@Injectable()
export class EvaluationConversationRunLlmService extends LlmServiceBase {
  private readonly logger = new Logger(EvaluationConversationRunLlmService.name)

  constructor(
    private readonly agentLlmRequestService: AgentLlmRequestService,
    @Inject(LLM_PROVIDERS)
    llmProviders: LlmProviders,
  ) {
    super(llmProviders)
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
  }: {
    agent: Agent
    agentSettings: AgentSettings
    connectScope: RequiredConnectScope
    userContent: string
  }): Promise<{ output: string; traceId: string }> {
    const traceId = v4()
    const userMessage = { role: "user", content: userContent, status: null } as AgentMessage
    const session: PublicStreamingSessionProxy = {
      id: traceId,
      traceId,
      organizationId: connectScope.organizationId,
      messages: [userMessage],
      // No session row: nothing for a form to attach to, so no fillForm tool.
      persistsForms: false,
    }

    const { config, callContext, messages, mcpClose, citations, classifyTurn } =
      await this.agentLlmRequestService.buildLLMRequest({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        includeSessionMetadataTools: false,
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
        callContext,
      })
      for await (const chunk of chunks) {
        output += citations.feed(chunk)
      }
      output += citations.flush()
      // Same post-turn step as Studio (sources only: no session to title).
      await classifyTurn({ answerText: output })
      return { output, traceId }
    } finally {
      await mcpClose?.()
    }
  }
}
