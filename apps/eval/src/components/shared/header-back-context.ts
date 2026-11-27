import { createContext } from "react"

/**
 * The element at the start of the shell's top bar, after the sidebar's button, where a page puts
 * its link back to the page above.
 */
export const HeaderBackContext = createContext<HTMLElement | null>(null)
