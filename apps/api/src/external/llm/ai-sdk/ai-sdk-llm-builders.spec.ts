import { AgentModel } from "@caseai-connect/api-contracts"
import { type JSONSchema7, tool } from "ai"
import { z } from "zod"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
} from "@/common/interfaces/llm-provider.interface"
import {
  AISDKLLMBuilders,
  type SpecificProviderOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"

type BuildArgs = {
  config: LLMConfig
  callOrigin: CallOrigin
  metadata: LLMMetadata
  schema?: JSONSchema7
  tags: string[]
}

class TestBuilders extends AISDKLLMBuilders {
  functionIdFor(messages: LLMChatMessage[]): string {
    return this.buildFunctionIdForStreamChatResponse(messages)
  }
  userMessageFor(messages: LLMChatMessage[]): string | undefined {
    return this.buildUserMessageForTelemetry(messages)
  }
  metadataFor(args: Omit<BuildArgs, "callOrigin">) {
    return this.buildMetadata(args)
  }
  protected buildSpecificProviderOptions(): SpecificProviderOptions {
    return {}
  }
}

describe("AISDKLLMBuilders", () => {
  const builders = new TestBuilders()

  const config: LLMConfig = {
    model: AgentModel._Mock,
    modelOptions: { temperature: 0 },
    systemPrompt: "You are a helpful assistant.",
    serviceTier: undefined,
  }

  const metadata: LLMMetadata = {
    traceId: "trace-id",
    agentSessionId: "agent-session-id",
    currentTurn: 2,
    organizationId: "organization-id",
    projectId: "project-id",
    agentId: "agent-id",
    revision: 3,
    tags: ["metadata-tag"],
  }

  describe("buildFunctionIdForStreamChatResponse", () => {
    it("counts the current turn on top of the assistant messages", () => {
      const messages: LLMChatMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "What can you do?" },
      ]

      expect(builders.functionIdFor(messages)).toBe("LLMProvider.streamChatResponse [2 turn(s)]")
    })

    it("names the first turn when no assistant answered yet", () => {
      expect(builders.functionIdFor([{ role: "user", content: "Hello" }])).toBe(
        "LLMProvider.streamChatResponse [1 turn(s)]",
      )
    })
  })

  describe("buildUserMessageForTelemetry", () => {
    it("returns the text of the last user message", () => {
      const messages: LLMChatMessage[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Second question" },
      ]

      expect(builders.userMessageFor(messages)).toBe("Second question")
    })

    it("joins the text parts and names the other parts by type", () => {
      const messages: LLMChatMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Summarize this file" },
            { type: "file", data: "aGVsbG8=", mediaType: "application/pdf" },
            { type: "text", text: "in three bullets" },
          ],
        },
      ]

      expect(builders.userMessageFor(messages)).toBe(
        "Summarize this file\n[file]\nin three bullets",
      )
    })

    it("returns undefined without a user message", () => {
      expect(builders.userMessageFor([{ role: "system", content: "System" }])).toBeUndefined()
    })

    it("returns undefined when the last user message has no part", () => {
      expect(builders.userMessageFor([{ role: "user", content: [] }])).toBeUndefined()
    })
  })

  describe("buildMetadata", () => {
    it("maps the call metadata and merges the tags", () => {
      const tools = {
        lookup: tool({
          description: "Looks up a topic",
          inputSchema: z.object({ topic: z.string() }),
        }),
      }
      const schema: JSONSchema7 = { type: "object", properties: { title: { type: "string" } } }

      const result = builders.metadataFor({
        config: { ...config, tools },
        metadata: {
          ...metadata,
          parentSessionId: "parent-session-id",
          spanLabel: "classification",
        },
        schema,
        tags: ["call-tag"],
      })

      expect(result).toEqual({
        sessionId: "trace-id",
        agentSessionId: "agent-session-id",
        parentSessionId: "parent-session-id",
        userId: "o:organization-id / p:project-id",
        tags: ["metadata-tag", "call-tag"],
        currentTurn: 2,
        revision: 3,
        outputSchema: JSON.stringify(schema),
        availableTools: JSON.stringify(tools),
        spanLabel: "classification",
      })
    })

    it("leaves out the fields that are not set", () => {
      const result = builders.metadataFor({ config, metadata, tags: [] })

      expect(result).toEqual({
        sessionId: "trace-id",
        agentSessionId: "agent-session-id",
        userId: "o:organization-id / p:project-id",
        tags: ["metadata-tag"],
        currentTurn: 2,
        revision: 3,
      })
    })
  })
})
