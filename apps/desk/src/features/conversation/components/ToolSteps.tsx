import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { CheckIcon, SparklesIcon } from "lucide-react"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

/** What a person reads while the agent uses a tool. The tools missing here read as a generic step. */
const TOOL_LABELS: Record<string, MessageDescriptor> = {
  lookup_knowledge_base: msg`Searching the knowledge base`,
  search_resources: msg`Searching the resources`,
  smart_search: msg`Searching the resources`,
  surfaceResources: msg`Picking useful resources`,
  fillForm: msg`Filling in the form`,
  consolidateForm: msg`Completing the form`,
  concludeHandoff: msg`Handing the conversation back`,
  saveMemory: msg`Remembering what matters`,
  forgetMemory: msg`Forgetting what you asked`,
}

/**
 * Tools the platform calls for itself after the reply, which say nothing to the person as steps:
 * the sources show under the reply instead.
 */
const HIDDEN_TOOLS = new Set(["recalculateConversationSessionMetadata", "sources"])

export type ToolStepsProps = {
  toolNames: string[]
  isWriting: boolean
  /** Whether the reply has text yet: until then, the agent shows as thinking. */
  hasText: boolean
}

/**
 * The steps of a reply, with the shadcn Trace. While the agent works, its steps show as they
 * come, the current one shimmering; once it answered, they fold into one line that opens.
 */
export function ToolSteps({ toolNames, isWriting, hasText }: ToolStepsProps) {
  const { t } = useLingui()
  const steps = toolNames.filter((toolName) => !HIDDEN_TOOLS.has(toolName))
  const labelOf = (toolName: string) => {
    const label = TOOL_LABELS[toolName]
    return label ? t(label) : t`Using a tool`
  }

  if (isWriting) {
    const isThinking = !hasText && steps.length === 0
    if (!isThinking && steps.length === 0) return null
    return (
      <Trace aria-live="polite">
        {isThinking ? (
          <TraceLine status="running">
            <TraceIcon>
              <SparklesIcon />
            </TraceIcon>
            <TraceTitle>
              <Trans>Thinking…</Trans>
            </TraceTitle>
          </TraceLine>
        ) : null}
        {steps.map((toolName, index) => {
          const isCurrent = index === steps.length - 1 && !hasText
          return (
            // Steps only grow, and the same tool can run twice: the position is their identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above.
            <TraceLine key={index} status={isCurrent ? "running" : undefined}>
              <TraceIcon>{isCurrent ? <SparklesIcon /> : <CheckIcon />}</TraceIcon>
              <TraceTitle>{labelOf(toolName)}</TraceTitle>
            </TraceLine>
          )
        })}
      </Trace>
    )
  }

  if (steps.length === 0) return null
  const count = steps.length
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceTitle>
              <Plural value={count} one="Used a tool" other="Used tools" />
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ul className="flex flex-col gap-1">
            {steps.map((toolName, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the steps of a finished reply never change.
              <li key={index} className="flex items-center gap-2 text-sm">
                <CheckIcon aria-hidden className="size-4" />
                {labelOf(toolName)}
              </li>
            ))}
          </ul>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
