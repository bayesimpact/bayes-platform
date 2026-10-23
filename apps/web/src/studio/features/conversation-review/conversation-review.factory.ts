import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type {
  ConversationReview,
  ConversationReviewMessage,
  ConversationReviewSessionRow,
  PaginatedConversationReviewSessions,
} from "./conversation-review.models"

export const conversationReviewMessageFactory = Factory.define<ConversationReviewMessage>(
  ({ params, sequence }) => ({
    id: params.id ?? faker.string.uuid(),
    role: params.role ?? (sequence % 2 === 0 ? "assistant" : "user"),
    content: params.content ?? faker.lorem.sentence(),
    ...(params.status ? { status: params.status } : {}),
    toolNames: params.toolNames ?? [],
    createdAt: params.createdAt ?? faker.date.recent().getTime(),
  }),
)

export const conversationReviewFactory = Factory.define<ConversationReview>(({ params }) => {
  const createdAt = params.createdAt ?? faker.date.recent().getTime()
  return {
    sessionId: params.sessionId ?? faker.string.uuid(),
    agentId: params.agentId ?? faker.string.uuid(),
    kind: params.kind ?? "conversation",
    ...(params.kind === "public" ? {} : { type: params.type ?? "live" }),
    ...(params.channel ? { channel: params.channel } : {}),
    ...(params.externalVisitorId ? { externalVisitorId: params.externalVisitorId } : {}),
    ...(params.extraction
      ? {
          extraction: {
            status: params.extraction.status ?? "success",
            documentTitle: params.extraction.documentTitle ?? faker.system.fileName(),
            ...(params.extraction.result ? { result: params.extraction.result } : {}),
            ...(params.extraction.errorCode ? { errorCode: params.extraction.errorCode } : {}),
          },
        }
      : {}),
    ...(params.title ? { title: params.title } : {}),
    isSubSession: params.isSubSession ?? false,
    isPurged: params.isPurged ?? false,
    createdAt,
    updatedAt: params.updatedAt ?? createdAt,
    messages: params.messages ?? [],
  }
})

export const conversationReviewSessionRowFactory = Factory.define<ConversationReviewSessionRow>(
  ({ params, sequence }) => {
    const kind = params.kind ?? (sequence % 3 === 0 ? "public" : "conversation")
    return {
      sessionId: params.sessionId ?? faker.string.uuid(),
      kind,
      ...(kind === "conversation"
        ? {
            conversationType:
              params.conversationType ?? (sequence % 2 === 0 ? "live" : "playground"),
          }
        : {}),
      isSubSession: params.isSubSession ?? false,
      ...(kind === "public" ? { channel: params.channel ?? "embed" } : {}),
      categoryId: params.categoryId ?? null,
      categoryName: params.categoryName ?? "Support",
      createdAt: params.createdAt ?? faker.date.recent().getTime(),
    }
  },
)

export const paginatedConversationReviewSessionsFactory =
  Factory.define<PaginatedConversationReviewSessions>(({ params }) => ({
    sessions: params.sessions ?? [],
    total: params.total ?? 0,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  }))
