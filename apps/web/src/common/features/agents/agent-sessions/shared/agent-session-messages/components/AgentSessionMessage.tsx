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
import { AlertCircleIcon, CheckIcon, ChevronRightIcon, CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FeedbackCreator } from "@/common/components/FeedbackCreator"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { FormResultSheet } from "@/common/features/agents/agent-sessions/conversation/components/FormResultSheet"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { useAppSelector } from "@/common/store/hooks"
import { selectStreamingToolSteps } from "../agent-session-messages.selectors"
import { Attachment } from "./Attachment"
import { useFormResult } from "./form-result-context"
import { useFormSubSessions } from "./form-sub-sessions-context"
import { MarkdownWrapper } from "./MarkdownWrapper"
import { SourcesTool } from "./SourcesTool"
import { SubAgentFormResultSheet } from "./SubAgentFormResultSheet"
import { SurfaceResourcesTool } from "./SurfaceResourcesTool"

export function AgentSessionMessage({ message }: { message: AgentSessionMessageType }) {
  const formSubSessions = useFormSubSessions()
  const formResult = useFormResult()

  switch (message.role) {
    case "assistant": {
      const isStreaming = message.status === "streaming"
      const hasContent = message.content.trim().length > 0
      const isError = message.status === "error"
      // This turn ran the fillForm tool, so its footer can open the form result.
      const filledForm = (message.toolCalls ?? []).some((call) => call.name === ToolName.FillForm)
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
        <Message align="start">
          <MessageContent>
            {/* Reasoning / tool timeline lives above the answer, outside the bubble. */}
            <ThinkingSteps message={message} isStreaming={isStreaming} />

            {isError ? (
              <Bubble variant="destructive">
                <BubbleContent className="px-4 py-3">
                  <ErrorMessage />
                </BubbleContent>
              </Bubble>
            ) : (
              hasContent && (
                <Bubble variant="muted">
                  <BubbleContent className="px-4 py-3">
                    <MarkdownWrapper content={message.content} />
                  </BubbleContent>
                </Bubble>
              )
            )}

            {!isStreaming && surfaceResourcesTool && (
              <SurfaceResourcesTool toolCall={surfaceResourcesTool} />
            )}

            {!isStreaming && (
              <MessageFooter className="gap-0 px-1">
                <FeedbackCreator message={message} />

                <CopyToClipboard content={message.content} />

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

function ErrorMessage() {
  const { t } = useTranslation("status")
  return (
    <div className="flex items-center gap-2">
      <AlertCircleIcon className="size-4" />
      <span className="font-semibold">{t("error")}</span>
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
