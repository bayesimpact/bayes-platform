import { createContext, useContext } from "react"

/**
 * The form definition + accumulated result of the current fillForm-enabled agent
 * session, carried down to the individual tool-step renderers so the "Filling in
 * the form…" step can open the result in a sheet. Null when the agent has no
 * fillForm tool (or no schema), so those surfaces render no affordance.
 */
export type FormResultContextValue = {
  outputJsonSchema: Record<string, unknown>
  result?: Record<string, unknown>
}

const FormResultContext = createContext<FormResultContextValue | null>(null)

export const FormResultProvider = FormResultContext.Provider

export function useFormResult() {
  return useContext(FormResultContext)
}
