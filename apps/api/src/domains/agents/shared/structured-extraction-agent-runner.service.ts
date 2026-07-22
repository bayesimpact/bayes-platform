import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common"
import { v4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { ServiceWithLLM } from "@/external/llm"
import type { AgentWithSettingsRunJobPayload } from "./agent-with-settings-run.types"

/**
 * The subset of a CSV column mapping needed to build the agent input text.
 * Structurally satisfied by both the Studio CSV extraction column schema and
 * the evaluation extraction dataset schema mapping.
 */
export type StructuredExtractionInputColumn = {
  id: string
  finalName: string
  role: string
  index: number
}

/**
 * Runs a structured-output extraction agent on one CSV row.
 *
 * Single source of truth shared by Studio CSV extraction runs and extraction
 * evaluation runs, so the evaluated agent receives the exact same system
 * prompt, input format and provider call as the Studio one.
 */
@Injectable()
export class StructuredExtractionAgentRunnerService extends ServiceWithLLM {
  constructor(
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
   * Serializes a row's input columns to the text prompt sent to the agent,
   * ordered by the original column position.
   */
  buildInputText({
    rowData,
    columnSchema,
  }: {
    rowData: Record<string, unknown>
    columnSchema: Record<string, StructuredExtractionInputColumn>
  }): string {
    const inputColumns = Object.values(columnSchema)
      .filter((column) => column.role === "input")
      .sort((columnA, columnB) => columnA.index - columnB.index)

    const lines: string[] = []
    for (const column of inputColumns) {
      const value = rowData[column.id]
      lines.push(`${column.finalName}: ${value ?? ""}`)
    }
    return lines.join("\n")
  }

  async invokeAgent({
    agentWithSettings,
    inputText,
    connectScope,
    runTag,
  }: {
    agentWithSettings: AgentWithSettingsRunJobPayload
    inputText: string
    connectScope: RequiredConnectScope
    runTag: string
  }): Promise<{ output: Record<string, unknown>; traceId: string }> {
    if (!agentWithSettings.outputJsonSchema) {
      throw new UnprocessableEntityException(
        "Agent must have an outputJsonSchema for extraction runs",
      )
    }

    const traceId = v4()
    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: inputText }],
    }

    const systemPrompt = `${agentWithSettings.instructions}\n\nToday's date: ${new Date().toLocaleDateString()}`

    const llmConfig = this.buildLLMConfig({
      systemPrompt,
      model: agentWithSettings.model,
      temperature: agentWithSettings.temperature,
    })

    const llmMetadata: LLMMetadata = {
      traceId,
      agentSessionId: traceId,
      currentTurn: 1,
      organizationId: connectScope.organizationId,
      agentId: agentWithSettings.id,
      revision: agentWithSettings.revision,
      projectId: connectScope.projectId,
      tags: [
        agentWithSettings.name,
        `rev-${agentWithSettings.revision}`,
        agentWithSettings.type,
        runTag,
      ],
    }

    const output = await this.getProviderForModel(agentWithSettings.model).generateStructuredOutput(
      {
        message: llmMessage,
        schema: agentWithSettings.outputJsonSchema,
        config: llmConfig,
        metadata: llmMetadata,
      },
    )

    return { output, traceId }
  }
}
