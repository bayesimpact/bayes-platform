import type { AgentVersionOutputDto } from "@bayes-platform/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** Which of the project's documents a version of an agent searches, as the app says it. */
export const DOCUMENT_SEARCH_LABELS = {
  all: msg({ message: "All the documents", comment: "An agent searches every document" }),
  none: msg({ message: "No document", comment: "An agent searches no document" }),
  tags: msg({
    message: "The documents of its tags",
    comment: "An agent searches the documents that carry its tags",
  }),
} satisfies Record<AgentVersionOutputDto["documentsRagMode"], MessageDescriptor>
