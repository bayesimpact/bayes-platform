import { createContext } from "react"

/** The element at the end of the shell's top bar, where a page puts its actions. */
export const HeaderActionsContext = createContext<HTMLElement | null>(null)
