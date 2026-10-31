import {
  DeskAccountRoutes,
  DeskAgentSessionsRoutes,
  DeskAgentsRoutes,
  DeskConversationsRoutes,
  DeskDocumentsRoutes,
  DeskInvitationsRoutes,
  DeskMemoriesRoutes,
  DeskOrganizationsRoutes,
  DeskProjectsRoutes,
  type MemoryOutputDto,
  type MeOutputDto,
} from "@caseai-connect/desk-contracts"
import { HttpResponse, http } from "msw"
import { buildMe } from "../factories/account.factory"
import {
  buildConversationMessage,
  buildConversationSession,
  buildToolCall,
} from "../factories/agent-sessions.factory"
import { buildDeskWorld, type DeskWorld } from "../factories/desk-world.factory"
import { extractionHandlers } from "./extraction-handlers"
import { apiError, type MockStreamFrame, mockRoute, mockStreamRoute } from "./mock-route"

type ReplyFrame = MockStreamFrame<typeof DeskConversationsRoutes.streamReply>

/** Where the mocked storage takes the attachments, outside the API. */
const ATTACHMENT_STORAGE_ORIGIN = "https://storage.example.org"

/** The words of a reply, two by two, as the chunks of its stream. */
function chunksOf(text: string): string[] {
  const words = text.split(" ")
  const chunks: string[] = []
  for (let index = 0; index < words.length; index += 2) {
    chunks.push(`${index > 0 ? " " : ""}${words.slice(index, index + 2).join(" ")}`)
  }
  return chunks
}

/** `GET me`, answered with the given person, who accepted the terms, and their new name. */
const meHandlers = (me: MeOutputDto = buildMe()) => [
  mockRoute(DeskAccountRoutes.getMe, () => me),
  mockRoute(DeskAccountRoutes.patchMe, ({ payload }) => {
    me.user.name = payload.name
    return { success: true }
  }),
]

/** A person who has not accepted the current terms yet, until they do. */
export function termsHandlers() {
  const me = buildMe({ termsAccepted: false })
  return [
    mockRoute(DeskAccountRoutes.getMe, () => me),
    mockRoute(DeskAccountRoutes.acceptTerms, () => {
      me.user.termsAccepted = true
      return { success: true }
    }),
  ]
}

/** The routes that read a world: projects, organizations, agents and each agent's history. */
export function worldHandlers(world: DeskWorld) {
  return [
    mockRoute(DeskProjectsRoutes.getAllMine, () => world.projects),
    mockRoute(DeskOrganizationsRoutes.getAllMine, () => world.organizations),
    mockRoute(DeskAgentsRoutes.getAllOfProject, ({ params }) =>
      world.agents.filter((agent) => agent.projectId === params.projectId),
    ),
    mockRoute(
      DeskAgentSessionsRoutes.getConversations,
      ({ params }) => world.conversations[params.agentId] ?? [],
    ),
    ...conversationHandlers(world),
    ...memoryHandlers(world),
    ...extractionHandlers(world),
    ...invitationHandlers(world),
  ]
}

/** The API as each test starts from it: the person, and the main world, built afresh. */
export function deskHandlers(world: DeskWorld = buildDeskWorld()) {
  return [...meHandlers(), ...worldHandlers(world)]
}

/** The person's invitations: an accepted one adds its agent to the world. */
function invitationHandlers(world: DeskWorld) {
  const answer = (invitationId: string, isAccepted: boolean) => {
    const pending = world.invitations.find((entry) => entry.invitation.id === invitationId)
    if (!pending) return apiError(404)
    world.invitations = world.invitations.filter((entry) => entry !== pending)
    if (isAccepted && pending.grantsAgent) world.agents.push(pending.grantsAgent)
    return { success: true }
  }
  return [
    mockRoute(DeskInvitationsRoutes.getMine, () => ({
      invitations: world.invitations.map((entry) => entry.invitation),
    })),
    mockRoute(DeskInvitationsRoutes.acceptOne, ({ params }) => answer(params.invitationId, true)),
    mockRoute(DeskInvitationsRoutes.declineOne, ({ params }) => answer(params.invitationId, false)),
  ]
}

/** What each agent remembers about the person: read it, forget facts, answer proposals. */
function memoryHandlers(world: DeskWorld) {
  return [
    mockRoute(DeskMemoriesRoutes.getAll, ({ params }) => world.memories[params.agentId] ?? []),
    mockRoute(DeskMemoriesRoutes.deleteOne, ({ params }) => {
      world.memories[params.agentId] = (world.memories[params.agentId] ?? []).filter(
        (memory) => memory.id !== params.memoryId,
      )
      return { success: true }
    }),
    mockRoute(DeskMemoriesRoutes.deleteAll, ({ params }) => {
      world.memories[params.agentId] = []
      return { success: true }
    }),
    mockRoute(DeskMemoriesRoutes.resolveProposals, ({ params, payload }) => {
      for (const decision of payload.decisions) {
        world.memories[params.agentId] = (world.memories[params.agentId] ?? []).flatMap(
          (memory): MemoryOutputDto[] => {
            if (memory.id !== decision.memoryId) return [memory]
            if (decision.decision === "reject") return []
            return [{ ...memory, status: "saved", content: decision.content ?? memory.content }]
          },
        )
      }
      return world.memories[params.agentId] ?? []
    }),
  ]
}

/** A person's conversations: start one, read its messages, send a message, delete it. */
function conversationHandlers(world: DeskWorld) {
  return [
    mockRoute(DeskConversationsRoutes.createOne, ({ params }) => {
      const conversation = buildConversationSession({ title: undefined, createdAt: Date.now() })
      world.conversations[params.agentId] = [
        conversation,
        ...(world.conversations[params.agentId] ?? []),
      ]
      world.messages[conversation.id] = [buildConversationMessage({ createdAt: Date.now() })]
      return { id: conversation.id }
    }),
    mockRoute(DeskConversationsRoutes.deleteOne, ({ params }) => {
      world.conversations[params.agentId] = (world.conversations[params.agentId] ?? []).filter(
        (conversation) => conversation.id !== params.agentSessionId,
      )
      // As the API does, a deleted conversation's messages are gone with it.
      delete world.messages[params.agentSessionId]
      return { success: true }
    }),
    mockRoute(DeskConversationsRoutes.createMessageFeedback, ({ params, payload }) => {
      world.feedbacks.push({ agentMessageId: params.agentMessageId, content: payload.content })
      return { success: true }
    }),
    mockRoute(DeskDocumentsRoutes.getIsPublic, () => ({ isPublicDocument: true })),
    mockRoute(DeskDocumentsRoutes.getTemporaryUrl, () => ({
      url: "https://example.org/pricing-guide.pdf",
    })),
    // The HTML of the apps the conversation's replies show.
    mockRoute(DeskConversationsRoutes.getMcpAppsHtml, ({ params }) => {
      const shownApps = (world.messages[params.agentSessionId] ?? [])
        .flatMap((message) => message.toolCalls ?? [])
        .flatMap((toolCall) => (toolCall.mcpApp ? [toolCall.mcpApp] : []))
      return world.mcpAppsHtml.filter((app) =>
        shownApps.some(
          (shown) => shown.mcpServerId === app.mcpServerId && shown.resourceUri === app.resourceUri,
        ),
      )
    }),
    mockRoute(DeskConversationsRoutes.presignAttachment, () => {
      const attachmentDocumentId = crypto.randomUUID()
      return {
        attachmentDocumentId,
        uploadUrl: `${ATTACHMENT_STORAGE_ORIGIN}/uploads/${attachmentDocumentId}`,
      }
    }),
    // The signed URL of the storage, which no contract describes: it takes the file's bytes.
    http.put(
      `${ATTACHMENT_STORAGE_ORIGIN}/uploads/:attachmentDocumentId`,
      () => new HttpResponse(null, { status: 200 }),
    ),
    mockRoute(DeskConversationsRoutes.getAttachmentUrl, ({ params }) => ({
      url: `${ATTACHMENT_STORAGE_ORIGIN}/files/${params.attachmentDocumentId}`,
    })),
    mockRoute(DeskConversationsRoutes.getMessages, ({ params }) => {
      const messages = world.messages[params.agentSessionId]
      return messages ?? apiError(404)
    }),
    mockStreamRoute(DeskConversationsRoutes.streamReply, ({ params, payload }) => {
      const { content, attachmentDocumentId } = payload
      const reply = buildConversationMessage({
        content:
          `Here is what I found about "${content}". ` +
          "The answer depends on your plan, so here are the options that apply to you:\n\n" +
          "1. **Starter**, for a single team.\n2. **Pro**, for several teams.\n\n" +
          '```json\n{ "plan": "pro", "seats": 5 }\n```',
        toolCalls: [buildToolCall({ name: "lookup_knowledge_base" })],
      })
      world.messages[params.agentSessionId] = [
        ...(world.messages[params.agentSessionId] ?? []),
        buildConversationMessage({ role: "user", content, attachmentDocumentId }),
        reply,
      ]
      for (const conversation of world.conversations[params.agentId] ?? []) {
        if (conversation.id === params.agentSessionId && conversation.title === undefined) {
          conversation.title = content.slice(0, 40)
        }
      }
      return [
        { event: { type: "start", messageId: reply.id } },
        { event: { type: "notify_client", toolName: "lookup_knowledge_base" } },
        ...chunksOf(reply.content).map(
          (chunk): ReplyFrame => ({
            event: { type: "chunk", messageId: reply.id, content: chunk },
          }),
        ),
        { event: { type: "end", messageId: reply.id, fullContent: reply.content } },
      ]
    }),
  ]
}
