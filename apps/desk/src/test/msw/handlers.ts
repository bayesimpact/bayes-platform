import type { MeOutputDto, MyProjectOutputDto } from "@caseai-connect/desk-contracts"
import { delay, HttpResponse, http } from "msw"
import { buildMe } from "../factories/account.factory"
import {
  buildConversationMessage,
  buildConversationSession,
} from "../factories/agent-sessions.factory"
import {
  buildDeskWorld,
  buildEmptyHistoryWorld,
  buildExtractionAgentWorld,
  buildNoAgentWorld,
  buildSeveralAgentsWorld,
  buildSeveralProjectsWorld,
  type DeskWorld,
  RELEASE_NOTES_APP,
} from "../factories/desk-world.factory"
import { RELEASE_NOTES_APP_HTML } from "../fixtures/mcp-app"
import { extractionHandlers } from "./extraction-handlers"

const agentPath = "*/api/organizations/:organizationId/projects/:projectId/agents/:agentId"
const messagesPath = `${agentPath}/agent-sessions/live/:agentSessionId/messages`

/** One server-sent event, as Nest writes it. */
const sseFrame = (data: unknown) => `id: 1\ndata: ${JSON.stringify(data)}\n\n`

/** A reply streamed in a few chunks, with a pause between them as a real agent takes. */
function replyStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      for (const frame of frames) {
        await delay()
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })
}

/** The words of a reply, two by two, as the chunks of its stream. */
function chunksOf(text: string): string[] {
  const words = text.split(" ")
  const chunks: string[] = []
  for (let index = 0; index < words.length; index += 2) {
    chunks.push(`${index > 0 ? " " : ""}${words.slice(index, index + 2).join(" ")}`)
  }
  return chunks
}

/** `GET me`, answered with the given person. */
const meHandler = (me: MeOutputDto = buildMe()) =>
  http.get("*/api/me", () => HttpResponse.json({ data: me }))

/** `GET projects/mine`, answered with the given projects. */
const myProjectsHandler = (projects: MyProjectOutputDto[]) =>
  http.get("*/api/projects/mine", () => HttpResponse.json({ data: projects }))

/** The routes that read a world: projects, organizations, agents and each agent's history. */
export function worldHandlers(world: DeskWorld) {
  return [
    myProjectsHandler(world.projects),
    http.get("*/api/organizations/mine", () => HttpResponse.json({ data: world.organizations })),
    http.get("*/api/organizations/:organizationId/projects/:projectId/agents", ({ params }) =>
      HttpResponse.json({
        data: world.agents.filter((agent) => agent.projectId === params.projectId),
      }),
    ),
    http.post(`${agentPath}/conversation-agent-sessions/live`, ({ params }) =>
      HttpResponse.json({ data: world.conversations[String(params.agentId)] ?? [] }),
    ),
    ...conversationHandlers(world),
    ...memoryHandlers(world),
    ...extractionHandlers(world),
  ]
}

/** What each agent remembers about the person: read it, forget facts, answer proposals. */
function memoryHandlers(world: DeskWorld) {
  const memoriesPath = `${agentPath}/memories/live`
  return [
    http.get(memoriesPath, ({ params }) =>
      HttpResponse.json({ data: world.memories[String(params.agentId)] ?? [] }),
    ),
    http.delete(`${memoriesPath}/:memoryId`, ({ params }) => {
      const agentId = String(params.agentId)
      world.memories[agentId] = (world.memories[agentId] ?? []).filter(
        (memory) => memory.id !== params.memoryId,
      )
      return HttpResponse.json({ data: { success: true } })
    }),
    http.delete(memoriesPath, ({ params }) => {
      world.memories[String(params.agentId)] = []
      return HttpResponse.json({ data: { success: true } })
    }),
    http.post(`${memoriesPath}/resolve-proposals`, async ({ params, request }) => {
      const agentId = String(params.agentId)
      const body = (await request.json()) as {
        payload: { decisions: { memoryId: string; decision: string; content?: string }[] }
      }
      for (const decision of body.payload.decisions) {
        world.memories[agentId] = (world.memories[agentId] ?? []).flatMap((memory) => {
          if (memory.id !== decision.memoryId) return [memory]
          if (decision.decision === "reject") return []
          return [
            { ...memory, status: "saved" as const, content: decision.content ?? memory.content },
          ]
        })
      }
      return HttpResponse.json({ data: world.memories[agentId] ?? [] })
    }),
  ]
}

/** A person's conversations: start one, read its messages, send a message, delete it. */
function conversationHandlers(world: DeskWorld) {
  return [
    http.post(`${agentPath}/conversation-agent-sessions/live/create`, ({ params }) => {
      const agentId = String(params.agentId)
      const conversation = buildConversationSession({ title: undefined, createdAt: Date.now() })
      world.conversations[agentId] = [conversation, ...(world.conversations[agentId] ?? [])]
      world.messages[conversation.id] = [buildConversationMessage({ createdAt: Date.now() })]
      return HttpResponse.json({ data: { id: conversation.id } }, { status: 201 })
    }),
    http.post(
      `${agentPath}/conversation-agent-sessions/live/:agentSessionId/delete`,
      ({ params }) => {
        const agentId = String(params.agentId)
        world.conversations[agentId] = (world.conversations[agentId] ?? []).filter(
          (conversation) => conversation.id !== params.agentSessionId,
        )
        return HttpResponse.json({ data: { success: true } }, { status: 201 })
      },
    ),
    http.post(
      "*/api/organizations/:organizationId/projects/:projectId/agent-messages/:agentMessageId/feedbacks",
      async ({ params, request }) => {
        const body = (await request.json()) as { payload: { content: string } }
        world.feedbacks.push({
          agentMessageId: String(params.agentMessageId),
          content: body.payload.content,
        })
        return HttpResponse.json({ data: { success: true } }, { status: 201 })
      },
    ),
    http.get(
      "*/api/organizations/:organizationId/projects/:projectId/documents/:documentId/is-public",
      () => HttpResponse.json({ data: { isPublicDocument: true } }),
    ),
    http.get(
      "*/api/organizations/:organizationId/projects/:projectId/documents/:documentId/temporary-url",
      () => HttpResponse.json({ data: { url: "https://example.org/pricing-guide.pdf" } }),
    ),
    http.post(`${messagesPath}/mcp-app-html`, () =>
      HttpResponse.json(
        { data: [{ ...RELEASE_NOTES_APP, html: RELEASE_NOTES_APP_HTML }] },
        { status: 201 },
      ),
    ),
    http.post(`${messagesPath}/attachment-document/presign`, () => {
      const attachmentDocumentId = crypto.randomUUID()
      return HttpResponse.json(
        {
          data: {
            attachmentDocumentId,
            uploadUrl: `https://storage.example.org/uploads/${attachmentDocumentId}`,
          },
        },
        { status: 201 },
      )
    }),
    http.put(
      "https://storage.example.org/uploads/:attachmentDocumentId",
      () => new HttpResponse(null, { status: 200 }),
    ),
    http.post(
      `${messagesPath}/attachment-document/:attachmentDocumentId/temporary-url`,
      ({ params }) =>
        HttpResponse.json(
          { data: { url: `https://storage.example.org/files/${params.attachmentDocumentId}` } },
          { status: 201 },
        ),
    ),
    http.post(messagesPath, ({ params }) => {
      const messages = world.messages[String(params.agentSessionId)]
      return messages
        ? HttpResponse.json({ data: messages }, { status: 201 })
        : new HttpResponse(null, { status: 404 })
    }),
    http.get(`${messagesPath}/stream`, ({ params, request }) => {
      const agentSessionId = String(params.agentSessionId)
      const query = JSON.parse(new URL(request.url).searchParams.get("q") ?? "{}")
      const content: string = query.payload?.content ?? ""
      const attachmentDocumentId: string | undefined = query.payload?.attachmentDocumentId
      const reply = buildConversationMessage({
        content:
          `Here is what I found about "${content}". ` +
          "The answer depends on your plan, so here are the options that apply to you:\n\n" +
          "1. **Starter**, for a single team.\n2. **Pro**, for several teams.\n\n" +
          '```json\n{ "plan": "pro", "seats": 5 }\n```',
        toolCalls: [{ id: crypto.randomUUID(), name: "lookup_knowledge_base" }],
      })
      world.messages[agentSessionId] = [
        ...(world.messages[agentSessionId] ?? []),
        buildConversationMessage({ role: "user", content, attachmentDocumentId }),
        reply,
      ]
      const agentId = String(params.agentId)
      for (const conversation of world.conversations[agentId] ?? []) {
        if (conversation.id === agentSessionId && conversation.title === undefined) {
          conversation.title = content.slice(0, 40)
        }
      }
      const frames = [
        sseFrame({ type: "start", messageId: reply.id }),
        sseFrame({ type: "notify_client", toolName: "lookup_knowledge_base" }),
        ...chunksOf(reply.content).map((chunk) =>
          sseFrame({ type: "chunk", messageId: reply.id, content: chunk }),
        ),
        sseFrame({ type: "end", messageId: reply.id, fullContent: reply.content }),
      ]
      return new HttpResponse(replyStream(frames), {
        headers: { "Content-Type": "text/event-stream" },
      })
    }),
  ]
}

/** The API as the mock mode and the tests start from: one project, one agent. */
export const handlers = [meHandler(), ...worldHandlers(buildDeskWorld())]

/**
 * Other states of the screens, for the mock mode: `/app/?mock=agents`, `?mock=projects`,
 * `?mock=extraction`, `?mock=no-history`, `?mock=no-agent`, `?mock=error`, `?mock=loading`.
 */
export const mockScenarios = {
  agents: worldHandlers(buildSeveralAgentsWorld()),
  projects: worldHandlers(buildSeveralProjectsWorld()),
  extraction: worldHandlers(buildExtractionAgentWorld()),
  "no-history": worldHandlers(buildEmptyHistoryWorld()),
  "no-agent": worldHandlers(buildNoAgentWorld()),
  error: [http.get("*/api/projects/mine", () => new HttpResponse(null, { status: 503 }))],
  loading: [
    http.get("*/api/projects/mine", async () => {
      await delay("infinite")
      return HttpResponse.json({})
    }),
  ],
}
