import type { StopCondition, ToolSet } from "ai"

/**
 * Ends the tool loop once a terminal tool ran (a hand-over to a sub-agent).
 * The step that called it may carry the model's closing sentence; when it
 * does not, one more generation is allowed for that sentence, then the loop
 * stops whatever the model produces. Without this a model that keeps going
 * after the hand-over calls other tools (a second hand-over overriding the
 * first) or talks in the sub-agent's place.
 */
export function terminalToolsStopCondition({
  terminalToolNames,
}: {
  terminalToolNames: string[]
}): StopCondition<ToolSet> {
  const terminalTools = new Set(terminalToolNames)
  return ({ steps }) => {
    const terminalStepIndex = steps.findIndex((step) =>
      step.toolCalls.some((toolCall) => terminalTools.has(toolCall.toolName)),
    )
    if (terminalStepIndex === -1) return false
    const lastStep = steps.at(-1)
    if (!lastStep) return false
    if (lastStep.text.trim().length > 0) return true
    return steps.length > terminalStepIndex + 1
  }
}
