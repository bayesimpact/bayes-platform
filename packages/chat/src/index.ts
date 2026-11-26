// The chat's logic and hooks the Desk and Evaluation share: its messages, the stream of a reply,
// the annotations and quoted passages of a reply, its task checks, its MCP Apps, its resources,
// the document of the message box and the form that reports a problem with a reply. Only what
// the apps import is exported here, by name, so an export they stop using shows as unused.
export {
  ANNOTATION_LAYER_ATTRIBUTE,
  type Annotation,
  CITED_PASSAGE_ATTRIBUTE,
  citedPassageKey,
  composeMessage,
  isSameRange,
  messageSegmentsOf,
  QUOTABLE_ATTRIBUTE,
  quoteSourceOf,
  readQuotableSelection,
  saveAnnotation,
} from "./annotation"
export {
  applyReplyEvent,
  type ChatAttachment,
  type ChatMcpApp,
  type ChatMessage,
  type ChatResource,
  type ChatSource,
  type ChatToolResult,
  failStreamingReplies,
  findRetryableMessage,
  isBeingWritten,
  isLocalMessageId,
  lastReplyFollowUpQuestions,
  newLocalMessageId,
  type OutgoingMessage,
  type ReplyCursor,
  type ReplyFailure,
  setAttachmentDocument,
  startTurn,
  toChatMessages,
} from "./chat-messages"
export { useAnnotations } from "./hooks/use-annotations"
export { type CitedPassages, useCitedPassages } from "./hooks/use-cited-passages"
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
