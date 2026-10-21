import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Plural, useLingui } from "@lingui/react/macro"
import { CheckIcon, ChevronRightIcon, LoaderCircleIcon } from "lucide-react"

/** What a person reads while the agent uses a tool. The tools missing here read as a generic step. */
const TOOL_LABELS: Record<string, MessageDescriptor> = {
  lookup_knowledge_base: msg`Searching the knowledge base`,
  sources: msg`Gathering the sources`,
  search_resources: msg`Searching the resources`,
  smart_search: msg`Searching the resources`,
  surfaceResources: msg`Picking useful resources`,
  fillForm: msg`Filling in the form`,
  consolidateForm: msg`Completing the form`,
  concludeHandoff: msg`Handing the conversation back`,
  saveMemory: msg`Remembering what matters`,
  forgetMemory: msg`Forgetting what you asked`,
}

/** Tools the platform calls for itself, which say nothing to the person. */
const HIDDEN_TOOLS = new Set(["recalculateConversationSessionMetadata"])

/** The steps worth showing: the tools the agent called, without the platform's own. */
function visibleToolNames(toolNames: string[]): string[] {
  return toolNames.filter((toolName) => !HIDDEN_TOOLS.has(toolName))
}

export type ToolStepsProps = {
  toolNames: string[]
  isWriting: boolean
}

/**
 * The steps of a reply. While the agent works, its steps show as they come; once it answered,
 * they fold into one line that opens on demand.
 */
export function ToolSteps({ toolNames, isWriting }: ToolStepsProps) {
  const { t } = useLingui()
  const steps = visibleToolNames(toolNames)
  const labelOf = (toolName: string) => {
    const label = TOOL_LABELS[toolName]
    return label ? t(label) : t`Using a tool`
  }

  if (isWriting) {
    return (
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground" aria-live="polite">
        {steps.map((toolName, index) => (
          // Steps only grow, and the same tool can run twice: the position is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <li key={index} className="flex items-center gap-2">
            {index === steps.length - 1 ? (
              <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
            ) : (
              <CheckIcon aria-hidden className="size-4" />
            )}
            {labelOf(toolName)}
          </li>
        ))}
      </ul>
    )
  }

  if (steps.length === 0) return null
  const count = steps.length
  return (
    <details className="group text-sm text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
        <ChevronRightIcon
          aria-hidden
          className="size-4 transition-transform group-open:rotate-90"
        />
        <Plural value={count} one="Worked through # step" other="Worked through # steps" />
      </summary>
      <ul className="mt-1 flex flex-col gap-1 pl-5">
        {steps.map((toolName, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the steps of a finished reply never change.
          <li key={index} className="flex items-center gap-2">
            <CheckIcon aria-hidden className="size-4" />
            {labelOf(toolName)}
          </li>
        ))}
      </ul>
    </details>
  )
}
