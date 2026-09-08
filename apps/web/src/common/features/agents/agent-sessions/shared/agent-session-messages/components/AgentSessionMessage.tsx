import { type AgentSessionToolName, ToolName } from "@caseai-connect/api-contracts"
import { Bubble, BubbleContent } from "@caseai-connect/ui/shad/bubble"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/ui/shad/collapsible"
import { Marker, MarkerContent, MarkerIcon } from "@caseai-connect/ui/shad/marker"
import { Message, MessageContent, MessageFooter } from "@caseai-connect/ui/shad/message"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import type { TFunction } from "i18next"
import { AlertCircleIcon, CheckIcon, ChevronRightIcon, CopyIcon, RotateCcwIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FeedbackCreator } from "@/common/components/FeedbackCreator"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { FormResultSheet } from "@/common/features/agents/agent-sessions/conversation/components/FormResultSheet"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { selectMcpAppHtml, selectStreamingToolSteps } from "../agent-session-messages.selectors"
import { Attachment } from "./Attachment"
import { useFormResult } from "./form-result-context"
import { useFormSubSessions } from "./form-sub-sessions-context"
import { MarkdownWrapper } from "./MarkdownWrapper"
import { McpAppPlaceholder, McpAppView } from "./McpAppView"
import { getRenderableMcpApp, getReplyBubbleText, hasMcpAppCard } from "./mcp-app-view"
import { SourcesTool } from "./SourcesTool"
import { SubAgentFormResultSheet } from "./SubAgentFormResultSheet"
import { SurfaceResourcesTool } from "./SurfaceResourcesTool"

export function AgentSessionMessage({
  message,
  renderMessageVersion,
  onResend,
}: {
  message: AgentSessionMessageType
  renderMessageVersion?: (message: AgentSessionMessageType) => React.ReactNode
  /** Sends the turn that led to this reply again. Only offered on a failed last reply. */
  onResend?: () => void
}) {
  const { t } = useTranslation()
  const formSubSessions = useFormSubSessions()
  const formResult = useFormResult()
  // Card HTML is loaded after the transcript so a slow MCP server never delays the messages;
  // until it lands, each card holds its place with a placeholder.
  const mcpAppHtml = useAppSelector(selectMcpAppHtml)
  const mcpAppHtmlEntries = ADS.isFulfilled(mcpAppHtml) ? mcpAppHtml.value : []
  const isMcpAppHtmlPending = !ADS.isFulfilled(mcpAppHtml) && !ADS.isError(mcpAppHtml)
  // MCP App cards that gave up rendering; their reply text is shown instead.
  const [failedMcpAppToolCallIds, setFailedMcpAppToolCallIds] = useState<string[]>([])

  switch (message.role) {
    case "assistant": {
      const isStreaming = message.status === "streaming"
      const isError = message.status === "error"
      // The stream died with the server (typically a deploy mid-reply): nothing was written.
      const isInterrupted = message.status === "aborted"
      // This turn ran the fillForm tool, so its footer can open the form result.
      const filledForm = (message.toolCalls ?? []).some((call) => call.name === ToolName.FillForm)
      const sourcesTool = message.toolCalls?.find((call) => call.name === ToolName.Sources)
      const surfaceResourcesTool = message.toolCalls?.find(
        (call) => call.name === ToolName.SurfaceResources,
      )
      // Every card this reply shows, with its view once the HTML is here. A card without a view
      // is either still loading (placeholder) or unavailable (its text stands in).
      const mcpAppCards = (message.toolCalls ?? [])
        .filter(hasMcpAppCard)
        .map((toolCall) => ({ toolCall, view: getRenderableMcpApp(toolCall, mcpAppHtmlEntries) }))
      // Cards whose HTML never came, or that gave up rendering: their reply text is shown instead.
      const unavailableMcpAppToolCallIds = [
        ...failedMcpAppToolCallIds,
        ...mcpAppCards
          .filter(({ view }) => view === undefined && !isMcpAppHtmlPending)
          .map(({ toolCall }) => toolCall.id),
      ]
      // The reply text stays on screen next to its cards. The model may have written nothing
      // because it expected the card to speak for the tool: once the card gave up, the tool
      // result text stands in for the reply.
      const bubbleContent = getReplyBubbleText(
        message.content,
        message.toolCalls,
        unavailableMcpAppToolCallIds,
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
        <Message align="start">
          <MessageContent>
            {/* Reasoning / tool timeline lives above the answer, outside the bubble. */}
            <ThinkingSteps message={message} isStreaming={isStreaming} />

            {isError || isInterrupted ? (
              <Bubble variant="destructive">
                <BubbleContent className="px-4 py-3">
                  <FailureNotice
                    title={isInterrupted ? t("agentSessionMessage:interrupted") : t("status:error")}
                    // Failed turns store the human-readable reason in the message content (e.g.
                    // "PDF has 92 pages, but at most 20 pages can be converted to images").
                    detail={isInterrupted ? undefined : message.content}
                    onResend={onResend}
                  />
                </BubbleContent>
              </Bubble>
            ) : (
              bubbleContent.length > 0 && (
                <Bubble variant="muted">
                  <BubbleContent className="px-4 py-3">
                    <MarkdownWrapper content={bubbleContent} />
                  </BubbleContent>
                </Bubble>
              )
            )}

            {!isStreaming && surfaceResourcesTool && (
              <SurfaceResourcesTool toolCall={surfaceResourcesTool} />
            )}

            {!isStreaming &&
              mcpAppCards.map(({ toolCall, view }) =>
                view ? (
                  <McpAppView
                    key={toolCall.id}
                    html={view.html}
                    toolInput={view.toolInput}
                    toolResult={view.toolResult}
                    onRenderFailed={() =>
                      setFailedMcpAppToolCallIds((previous) =>
                        previous.includes(toolCall.id) ? previous : [...previous, toolCall.id],
                      )
                    }
                  />
                ) : (
                  isMcpAppHtmlPending && <McpAppPlaceholder key={toolCall.id} className="mt-2" />
                ),
              )}

            {!isStreaming && (
              <MessageFooter className="gap-0 px-1">
                {/* Nothing was written to rate or copy; tools that ran before the interruption
                    still persisted their results, so those affordances stay. */}
                {!isInterrupted && <FeedbackCreator message={message} />}

                {!isInterrupted && bubbleContent.length > 0 && (
                  <CopyToClipboard content={bubbleContent} />
                )}

                {renderMessageVersion?.(message)}

                {filledForm && formResult && (
                  <FormResultSheet
                    outputJsonSchema={formResult.outputJsonSchema}
                    result={formResult.result}
                  />
                )}

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
              </MessageFooter>
            )}
          </MessageContent>
        </Message>
      )
    }

    case "user":
      return (
        <Message align="end">
          <MessageContent>
            <Bubble align="end">
              <BubbleContent className="whitespace-pre-wrap px-4 py-3">
                {message.content}
              </BubbleContent>
            </Bubble>
            <Attachment message={message} />
          </MessageContent>
        </Message>
      )

    default:
      return null
  }
}

/**
 * A reply that failed or was interrupted: a title, the reason when one was recorded, and, on the
 * last reply of the thread, a way to send the turn again.
 */
function FailureNotice({
  title,
  detail,
  onResend,
}: {
  title: string
  detail?: string
  onResend?: () => void
}) {
  const { t } = useTranslation()
  const trimmedDetail = detail?.trim()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AlertCircleIcon className="size-4 shrink-0" />
        <span className="font-semibold">{title}</span>
      </div>
      {trimmedDetail && <p className="whitespace-pre-wrap text-sm">{trimmedDetail}</p>}
      {onResend && (
        <Button variant="outline" size="sm" className="w-fit" onClick={onResend}>
          <RotateCcwIcon className="size-3.5" />
          {t("actions:retry")}
        </Button>
      )}
    </div>
  )
}

/** Maps a running tool to a descriptive status key under the `status:activity` namespace. */
const TOOL_ACTIVITY_KEY: Record<string, string> = {
  [ToolName.McpSearchResources]: "activity.searchingResources",
  [ToolName.McpSmartSearch]: "activity.smartSearch",
  [ToolName.LookupKnowledgeBase]: "activity.lookupKnowledgeBase",
  // Legacy wire name kept so sessions recorded before the rename still show a label.
  retrieveProjectDocumentChunks: "activity.lookupKnowledgeBase",
  [ToolName.Sources]: "activity.gatheringSources",
  [ToolName.SurfaceResources]: "activity.surfacingResources",
  [ToolName.FillForm]: "activity.fillingForm",
  [ToolName.RecalculateConversationSessionMetadata]: "activity.recalculating",
}

/** Human label for a tool step: its mapped activity message, else a generic tool label. */
function toolStepLabel(t: TFunction, toolName: AgentSessionToolName): string {
  const activityLabelKey = TOOL_ACTIVITY_KEY[toolName] ?? "activity.usingTool"
  return t(`status:${activityLabelKey}`)
}

/** Distinct tools a completed message ran, preserving first-seen order for the timeline. */
function completedToolSteps(
  toolCalls: AgentSessionMessageType["toolCalls"],
): AgentSessionToolName[] {
  return [...new Set((toolCalls ?? []).map((call) => call.name))]
}

/**
 * Renders the assistant's reasoning above the answer bubble — Claude-style.
 * While streaming it's a live timeline (spinner on the active step); once the answer
 * is done it collapses into a compact "Worked through N steps" summary that expands.
 */
function ThinkingSteps({
  message,
  isStreaming,
}: {
  message: AgentSessionMessageType
  isStreaming: boolean
}) {
  if (isStreaming) return <StreamingSteps hasContent={message.content.trim().length > 0} />

  const toolNames = completedToolSteps(message.toolCalls)
  if (toolNames.length === 0) return null

  return <CompletedSteps toolNames={toolNames} />
}

/**
 * Live status while the assistant is streaming.
 * - No tools ran yet: a pulsing marker cycling through "thinking" phases so a long wait
 *   doesn't sit on a static label.
 * - Tools ran: an expanded timeline of the tools (each with its own label), followed by
 *   the same rotating "thinking" pulse as the active indicator until the answer flows.
 */
function StreamingSteps({ hasContent }: { hasContent: boolean }) {
  const { t } = useTranslation("status")
  const toolSteps = useAppSelector(selectStreamingToolSteps)

  // Answer already flowing and no tool ran: nothing worth showing.
  if (hasContent && toolSteps.length === 0) return null

  // No tool activity yet: rotate through "thinking" phases while we wait.
  if (toolSteps.length === 0) return <ThinkingPulse />

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {t("agentSessionMessage:steps.working", { count: toolSteps.length })}
      </span>
      <div className="ml-1.5 flex flex-col gap-1.5 border-l pl-3">
        {toolSteps.map((toolName, stepIndex) => (
          <Marker key={`${stepIndex}-${toolName}`}>
            <MarkerIcon>
              <CheckIcon className="text-emerald-600" />
            </MarkerIcon>
            <MarkerContent className="text-muted-foreground">
              {toolStepLabel(t, toolName)}
            </MarkerContent>
          </Marker>
        ))}
        {!hasContent && <ThinkingPulse />}
      </div>
    </div>
  )
}

/**
 * Pulsing "thinking" marker shown before any tool runs. Advances through a sequence of
 * phases ("Thinking…" → "Still thinking…" → … → "Starting to write…") every few seconds
 * so a long reasoning pause keeps feeling alive, settling on the final phase.
 */
const THINKING_TIMEOUT_MS = 2500 // 2.5s per phase, then stop at the last phase
function ThinkingPulse() {
  const { t } = useTranslation("agentSessionMessage")
  const phases = t("thinking", { returnObjects: true }) as string[]
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    if (phaseIndex >= phases.length - 1) return
    const timeout = setTimeout(() => setPhaseIndex((index) => index + 1), THINKING_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [phaseIndex, phases.length])

  return (
    <Marker className="animate-pulse">
      <MarkerIcon>
        <Spinner />
      </MarkerIcon>
      <MarkerContent>{phases[Math.min(phaseIndex, phases.length - 1)]}</MarkerContent>
    </Marker>
  )
}

/** Collapsed reasoning summary for a completed turn; expands into the full step timeline. */
function CompletedSteps({ toolNames }: { toolNames: AgentSessionToolName[] }) {
  const { t } = useTranslation()

  return (
    <Collapsible className="w-fit">
      <CollapsibleTrigger className="group/steps flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]/steps:rotate-90" />
        {t("agentSessionMessage:steps.summary", { count: toolNames.length })}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5">
        <div className="ml-1.5 flex flex-col gap-1.5 border-l pl-3">
          {toolNames.map((toolName, stepIndex) => (
            <Marker key={`${stepIndex}-${toolName}`}>
              <MarkerIcon>
                <CheckIcon className="text-emerald-600" />
              </MarkerIcon>
              <MarkerContent>{toolStepLabel(t, toolName)}</MarkerContent>
            </Marker>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
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
