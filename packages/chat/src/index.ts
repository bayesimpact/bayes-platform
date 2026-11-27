// The chat the Desk and Evaluation share: the chat object (`createChat`, which holds the calls to
// the API and the stream of a reply) and its provider, and the logic and hooks around it: the
// messages, the annotations and quoted passages of a reply, its task checks, its MCP Apps, its
// resources, the document of the message box and the form that reports a problem with a reply.
// Only what the apps import is exported here, by name, so an export they stop using shows as
// unused.
export {
  ANNOTATION_LAYER_ATTRIBUTE,
  type Annotation,
  CITED_PASSAGE_ATTRIBUTE,
  citedPassageKey,
  composeMessage,
  isSameRange,
  messageSegmentsOf,
  QUOTABLE_ATTRIBUTE,
  readQuotableSelection,
  saveAnnotation,
} from "./annotation"
export { createChat } from "./api/create-chat"
export {
  useOpenAttachment,
  useOpenDocument,
  useSendFeedback,
} from "./api/mutations"
export { ChatProvider } from "./ChatProvider"
export { useChat } from "./chat-context"
export {
  type ChatAttachment,
  type ChatMcpApp,
  type ChatMessage,
  type ChatResource,
  type ChatSource,
  type ChatToolResult,
  findRetryableMessage,
  isBeingWritten,
  isLocalMessageId,
  lastReplyFollowUpQuestions,
  type OutgoingMessage,
  type ReplyFailure,
  toChatMessages,
} from "./chat-messages"
export { isFormTool } from "./form-tools"
export { type CitedPassages, useCitedPassages } from "./hooks/use-cited-passages"
export { useConversationSend } from "./hooks/use-conversation-send"
export { useIsOverflowing } from "./hooks/use-is-overflowing"
export { useRangeEnd } from "./hooks/use-range-end"
export { type ReplyClick, useSettledSelection } from "./hooks/use-settled-selection"
export { type TaskChecks, useTaskChecks } from "./hooks/use-task-checks"
export {
  type AppsHtml,
  findMcpAppHtml,
  hasMeaningfulText,
  unavailableApps,
  withAppMessage,
} from "./mcp-apps"
export { messageDocumentOf, messageTextOf } from "./message-document"
export {
  type OpenedResource,
  openedResourceOf,
  resourceMediaOf,
  youtubeEmbedUrlOf,
} from "./resource-media"
export { reportFormSchema } from "./schemas"
export { type TaskCheck, taskCheckLine, taskChecksOf } from "./task-checks"
