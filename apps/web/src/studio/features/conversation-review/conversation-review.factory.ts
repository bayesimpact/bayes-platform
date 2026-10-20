import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { ConversationReview, ConversationReviewMessage } from "./conversation-review.models"

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
