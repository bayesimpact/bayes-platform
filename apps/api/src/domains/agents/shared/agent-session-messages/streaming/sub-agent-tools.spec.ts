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
      agentSessionScope: {
        agent: parentAgent,
        session: { id: "session-id", traceId: "trace-id", organizationId: "organization-id" },
        connectScope: { organizationId: "organization-id", projectId: "project-id" },
      } as never,
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
      conversationAgentSessionsService: {
        findOrCreateSubSession: jest.fn(),
      } as never,
      formAgentSessionsService: {
        findOrCreateSubSession: jest.fn(),
      } as never,
      buildTools: async ({
        onExecute,
      }: {
        onExecute: (toolExecution: ToolExecutionLog) => void
      }) => ({
        toolDescriptions: {},
        hasSubAgentTools: false,
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

  it("runs a form sub-agent against a dedicated form sub-session and prompts it to fill the form", async () => {
    const childAgent = {
      id: "form-agent-id",
      projectId: "project-id",
      organizationId: "organization-id",
      name: "Intake Form",
      defaultPrompt: "Collect the user details.",
      model: "mock-model",
      temperature: 0,
      locale: "en",
      type: "form",
      documentsRagMode: DocumentsRagMode.None,
      outputJsonSchema: { type: "object", properties: {} },
    }
    const parentAgent = {
      ...childAgent,
      id: "parent-agent-id",
      name: "Orchestrator",
      type: "conversation",
    }

    const subSession = {
      id: "sub-session-id",
      traceId: "sub-trace-id",
      organizationId: "organization-id",
      type: "playground",
      result: null,
      messages: [],
    }
    const findOrCreateSubSession = jest.fn().mockResolvedValue(subSession)
    let capturedMessages: { role: string; content: string }[] = []
    let capturedMetadata:
      | { traceId: string; agentSessionId: string; langfuseSessionId?: string; tags: string[] }
      | undefined

    const { tools } = await buildSubAgentTools({
      agentSessionScope: {
        agent: parentAgent,
        session: {
          id: "parent-session-id",
          traceId: "parent-trace-id",
          organizationId: "organization-id",
          userId: "user-id",
          type: "playground",
          messages: [],
        },
        connectScope: { organizationId: "organization-id", projectId: "project-id" },
      } as never,
      agentSubAgentsService: {
        listSubAgents: jest.fn().mockResolvedValue([
          {
            id: "sub-agent-id",
            parentAgentId: parentAgent.id,
            childAgentId: childAgent.id,
            toolName: "ask_intake_form",
            description: "Ask the intake form agent.",
            enabled: true,
            childAgent,
          },
        ]),
      } as never,
      buildLLMConfig: (params) => params as never,
      conversationAgentSessionsService: {
        findOrCreateSubSession: jest.fn(),
      } as never,
      formAgentSessionsService: { findOrCreateSubSession } as never,
      buildTools: async () => ({ toolDescriptions: {}, tools: {}, hasSubAgentTools: false }),
      generateMasterPrompt: () => "system prompt",
      getProviderForModel: () =>
        ({
          streamChatResponse: async function* ({ messages, metadata }) {
            capturedMessages = messages
            capturedMetadata = metadata
            yield "form answer"
          },
        }) as never,
      onExecute: () => {},
      projectsService: { hasFeature: jest.fn().mockResolvedValue(true) } as never,
    })

    const subAgentTool = tools.ask_intake_form as never as {
      execute: (input: { task: string; context: string }) => Promise<{ answer: string }>
    }
    const result = await subAgentTool.execute({ task: "My name is Alex.", context: "" })

    expect(findOrCreateSubSession).toHaveBeenCalledWith({
      connectScope: { organizationId: "organization-id", projectId: "project-id" },
      agentId: "form-agent-id",
      userId: "user-id",
      parentSessionId: "parent-session-id",
      type: "playground",
    })
    expect(capturedMessages).toHaveLength(1)
    expect(capturedMessages[0]?.role).toBe("user")
    expect(capturedMessages[0]?.content).toContain("My name is Alex.")
    expect(capturedMessages[0]?.content).toContain("fillForm")
    expect(result.answer).toBe("form answer")
    // The form sub-agent gets its own dedicated trace (the sub-session's), linked
    // back to the parent trace via a tag, but is grouped under the parent's
    // langfuse session so they share one session timeline.
    expect(capturedMetadata?.traceId).toBe("sub-trace-id")
    expect(capturedMetadata?.agentSessionId).toBe("sub-session-id")
    expect(capturedMetadata?.langfuseSessionId).toBe("parent-session-id")
    expect(capturedMetadata?.tags).toContain("parent-trace:parent-trace-id")
    expect(capturedMetadata?.tags).toContain("sub-agent")
  })

  it("runs a conversation sub-agent against a dedicated conversation sub-session", async () => {
    const childAgent = {
      id: "conversation-agent-id",
      projectId: "project-id",
      organizationId: "organization-id",
      name: "Pricing Expert",
      defaultPrompt: "Answer pricing questions.",
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

    const subSession = {
      id: "sub-session-id",
      traceId: "sub-trace-id",
      organizationId: "organization-id",
      type: "playground",
      messages: [],
    }
    const findOrCreateSubSession = jest.fn().mockResolvedValue(subSession)
    let capturedMessages: { role: string; content: string }[] = []
    let capturedMetadata:
      | { traceId: string; agentSessionId: string; langfuseSessionId?: string; tags: string[] }
      | undefined

    const { tools } = await buildSubAgentTools({
      agentSessionScope: {
        agent: parentAgent,
        session: {
          id: "parent-session-id",
          traceId: "parent-trace-id",
          organizationId: "organization-id",
          userId: "user-id",
          type: "playground",
          messages: [],
        },
        connectScope: { organizationId: "organization-id", projectId: "project-id" },
      } as never,
      agentSubAgentsService: {
        listSubAgents: jest.fn().mockResolvedValue([
          {
            id: "sub-agent-id",
            parentAgentId: parentAgent.id,
            childAgentId: childAgent.id,
            toolName: "ask_pricing_expert",
            description: "Ask the pricing expert.",
            enabled: true,
            childAgent,
          },
        ]),
      } as never,
      buildLLMConfig: (params) => params as never,
      conversationAgentSessionsService: { findOrCreateSubSession } as never,
      formAgentSessionsService: { findOrCreateSubSession: jest.fn() } as never,
      buildTools: async () => ({ toolDescriptions: {}, tools: {}, hasSubAgentTools: false }),
      generateMasterPrompt: () => "system prompt",
      getProviderForModel: () =>
        ({
          streamChatResponse: async function* ({ messages, metadata }) {
            capturedMessages = messages
            capturedMetadata = metadata
            yield "pricing answer"
          },
        }) as never,
      onExecute: () => {},
      projectsService: { hasFeature: jest.fn().mockResolvedValue(true) } as never,
    })

    const subAgentTool = tools.ask_pricing_expert as never as {
      execute: (input: { task: string; context: string }) => Promise<{ answer: string }>
    }
    const result = await subAgentTool.execute({ task: "How much is the pro plan?", context: "" })

    expect(findOrCreateSubSession).toHaveBeenCalledWith({
      connectScope: { organizationId: "organization-id", projectId: "project-id" },
      agentId: "conversation-agent-id",
      userId: "user-id",
      parentSessionId: "parent-session-id",
      type: "playground",
    })
    expect(capturedMessages).toHaveLength(1)
    expect(capturedMessages[0]?.role).toBe("user")
    expect(capturedMessages[0]?.content).toContain("How much is the pro plan?")
    expect(result.answer).toBe("pricing answer")
    // The conversation sub-agent gets its own dedicated trace (the sub-session's),
    // linked back to the parent trace via a tag, but is grouped under the parent's
    // langfuse session so they share one session timeline.
    expect(capturedMetadata?.traceId).toBe("sub-trace-id")
    expect(capturedMetadata?.agentSessionId).toBe("sub-session-id")
    expect(capturedMetadata?.langfuseSessionId).toBe("parent-session-id")
    expect(capturedMetadata?.tags).toContain("parent-trace:parent-trace-id")
    expect(capturedMetadata?.tags).toContain("sub-agent")
  })
})
