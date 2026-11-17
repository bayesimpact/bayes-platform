import { createContext, useContext } from "react"

/**
 * Closes the version history sheet around the caller. An action that ends the work in the
 * history, such as putting a version in production, calls it. Outside the sheet (a story of the
 * explorer alone) it does nothing.
 */
export const CloseAgentSettingsHistoryContext = createContext<() => void>(() => {})

export const useCloseAgentSettingsHistory = () => useContext(CloseAgentSettingsHistoryContext)
