import { DocumentsRagMode } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import { buildSubAgentTools } from "./sub-agent-tools"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

describe("buildSubAgentTools", () => {
  it("uses the sub-agent tool name as the notification key for child tool executions", async () => {
    const toolExecutions: ToolExecutionLog[] = []
    const childAgent = {
      id: "child-agent-id",
      projectId: "project-id",
      organizationId: "organization-id",
      name: "Helpful Assistant",
      defaultPrompt: "Answer delegated questions.",
      model: "mock-model",
      temperature: 0,
      locale: "en",
      type: "conversation",
      documentsRagMode: DocumentsRagMode.None,
    }
    const parentAgent = {
      ...childAgent,
      id: "parent-agent-id",
      name: "Orchestrator",
    }

    const { tools } = await buildSubAgentTools({
      agent: parentAgent as never,
      agentSubAgentsService: {
        listSubAgents: jest.fn().mockResolvedValue([
          {
            id: "sub-agent-id",
            parentAgentId: parentAgent.id,
            childAgentId: childAgent.id,
            toolName: "ask_helpful_assistant",
            description: "Ask the helpful assistant.",
            enabled: true,
            childAgent,
          },
        ]),
      } as never,
      buildLLMConfig: (params) => params as never,
      buildTools: async ({ onExecute }) => ({
        toolDescriptions: {},
        tools: {
          child_lookup: tool({
            description: "Look up child context.",
            inputSchema: z.object({ query: z.string() }),
            execute: async (input) => {
              onExecute({ toolName: "child_lookup", arguments: input })
              return "child context"
            },
          }),
        },
      }),
      connectScope: { organizationId: "organization-id", projectId: "project-id" },
      generateMasterPrompt: () => "system prompt",
      getProviderForModel: () =>
        ({
          streamChatResponse: async function* ({ config }) {
            expect(config.tools).toBeDefined()
            const childLookupTool = (
              config.tools as never as Record<string, { execute: (input: unknown) => unknown }>
            ).child_lookup
            expect(childLookupTool).toBeDefined()
            await (childLookupTool as { execute: (input: unknown) => unknown }).execute({
              query: "pricing",
            })
            yield "answer"
          },
        }) as never,
      onExecute: (toolExecution) => toolExecutions.push(toolExecution),
      projectsService: {
        hasFeature: jest.fn().mockResolvedValue(true),
      } as never,
      sessionId: "session-id",
    })

    expect(tools.ask_helpful_assistant).toBeDefined()
    const subAgentTool = tools.ask_helpful_assistant as never as {
      execute: (input: { task: string; context: string }) => Promise<unknown>
    }
    await subAgentTool.execute({ task: "Help with pricing.", context: "" })

    expect(toolExecutions).toEqual([
      {
        toolName: "ask_helpful_assistant",
        arguments: { task: "Help with pricing.", context: "" },
      },
      {
        toolName: "child_lookup",
        notifyToolName: "ask_helpful_assistant",
        arguments: { query: "pricing" },
      },
    ])
  })
})
