import { ToolName } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Marker, MarkerContent, MarkerIcon } from "@caseai-connect/ui/shad/marker"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { cn } from "@caseai-connect/ui/utils"
import { AlertCircleIcon, CheckIcon, CopyIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FeedbackCreator } from "@/common/components/FeedbackCreator"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { useAppSelector } from "@/common/store/hooks"
import { selectStreamingToolSteps } from "../agent-session-messages.selectors"
import { Attachment } from "./Attachment"
import { ChatBotMessage, ChatUserMessage } from "./Chat"
import { useFormSubSessions } from "./form-sub-sessions-context"
import { MarkdownWrapper } from "./MarkdownWrapper"
import { SourcesTool } from "./SourcesTool"
import { SubAgentFormResultSheet } from "./SubAgentFormResultSheet"
import { SurfaceResourcesTool } from "./SurfaceResourcesTool"

export function AgentSessionMessage({ message }: { message: AgentSessionMessageType }) {
  const formSubSessions = useFormSubSessions()

  switch (message.role) {
    case "assistant": {
      const isStreaming = message.status === "streaming"
      const isEmpty = message.content.trim().length === 0 && message.status === "completed"
      const isError = message.status === "error"
      const sourcesTool = message.toolCalls?.find((call) => call.name === ToolName.Sources)
      const surfaceResourcesTool = message.toolCalls?.find(
        (call) => call.name === ToolName.SurfaceResources,
      )
      // Tool names this message delegated to that resolved to a form sub-session,
      // deduplicated so a sub-agent invoked twice shows a single affordance.
      const delegatedToolNames = [
        ...new Set(
          (message.toolCalls ?? [])
            .map((call) => call.name)
            .filter((name) => formSubSessions.some((subSession) => subSession.toolName === name)),
        ),
      ]
      return (
        <div key={message.id} className="max-w-3/4 relative">
          <ChatBotMessage>
            {!isEmpty && (
              <div
                className={cn(
                  "rounded-2xl p-4 bg-muted w-fit h-fit",
                  isError && "bg-red-50 border border-red-200 text-red-800",
                )}
              >
                {isStreaming && <ThinkingStatus hasContent={message.content.trim().length > 0} />}
                {isError ? <ErrorMessage /> : <MarkdownWrapper content={message.content} />}
              </div>
            )}

            {!isStreaming && surfaceResourcesTool && (
              <SurfaceResourcesTool toolCall={surfaceResourcesTool} />
            )}

            {!isStreaming && (
              <div className="w-full mt-1 flex items-center">
                <FeedbackCreator message={message} />

                <CopyToClipboard content={message.content} />

                <RestrictedFeature feature="sources-tool">
                  {sourcesTool && <SourcesTool toolCall={sourcesTool} />}
                </RestrictedFeature>

                {delegatedToolNames.map((toolName) => (
                  <SubAgentFormResultSheet
                    key={toolName}
                    subSessions={formSubSessions}
                    defaultToolName={toolName}
                  />
                ))}
              </div>
            )}
          </ChatBotMessage>
        </div>
      )
    }
    case "user":
      return (
        <div className="flex flex-col gap-2 items-end">
          <ChatUserMessage key={message.id}>{message.content}</ChatUserMessage>
          <Attachment message={message} />
        </div>
      )

    default:
      return null
  }
}

function ErrorMessage() {
  const { t } = useTranslation("status")
  return (
    <div className="flex items-center gap-2 mb-2 w-30">
      <AlertCircleIcon className="size-4 text-red-600" />
      <span className="font-semibold text-red-700">{t("error")}</span>
    </div>
  )
}

/** Maps a running tool to a descriptive status key under the `status:activity` namespace. */
const TOOL_ACTIVITY_KEY: Record<string, string> = {
  [ToolName.McpSearchResources]: "activity.searchingResources",
  [ToolName.McpSmartSearch]: "activity.smartSearch",
  [ToolName.RetrieveProjectDocumentChunks]: "activity.retrievingDocuments",
  [ToolName.Sources]: "activity.gatheringSources",
  [ToolName.SurfaceResources]: "activity.surfacingResources",
  [ToolName.FillForm]: "activity.fillingForm",
  [ToolName.RecalculateConversationSessionMetadata]: "activity.recalculating",
}

/**
 * Live status while the assistant is streaming. Each tool the agent runs is added as a
 * timeline step: finished steps show a check, the current step shows a spinner. Once the
 * answer text starts flowing every tool step is considered done.
 */
function ThinkingStatus({ hasContent, className }: { hasContent: boolean; className?: string }) {
  const { t } = useTranslation("status")
  const toolSteps = useAppSelector(selectStreamingToolSteps)

  // Nothing worth showing: the answer is already streaming and no tool ran.
  if (hasContent && toolSteps.length === 0) return null

  // With no tool activity yet, show a single generic "Thinking…" step.
  const steps = toolSteps.length > 0 ? toolSteps : [null]

  return (
    <div className={cn("mb-2 flex flex-col gap-1.5", className)}>
      {steps.map((toolName, stepIndex) => {
        const isActive = !hasContent && stepIndex === steps.length - 1
        const labelKey =
          toolName && TOOL_ACTIVITY_KEY[toolName] ? TOOL_ACTIVITY_KEY[toolName] : "activity.default"
        return (
          <Marker
            key={`${stepIndex}-${toolName ?? "thinking"}`}
            className={cn(isActive && "animate-pulse")}
          >
            <MarkerIcon>
              {isActive ? <Spinner /> : <CheckIcon className="text-emerald-600" />}
            </MarkerIcon>
            <MarkerContent className={cn(!isActive && "text-muted-foreground")}>
              {t(labelKey)}
            </MarkerContent>
          </Marker>
        )
      })}
    </div>
  )
}

function CopyToClipboard({ content }: { content: string }) {
  const { copy, isCopied } = useCopyToClipboard("Copied to clipboard!")
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      disabled={isCopied}
      onClick={() => void copy(content)}
    >
      <CopyIcon className="size-3.5" />
    </Button>
  )
}
