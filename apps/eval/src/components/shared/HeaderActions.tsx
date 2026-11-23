import { type ReactNode, useContext } from "react"
import { createPortal } from "react-dom"
import { HeaderSlotsContext } from "./header-slots-context"

export type HeaderActionsProps = {
  children: ReactNode
}

/**
 * Puts a page's actions at the end of the shell's top bar, aligned with its title, as the Claude
 * app does: the page renders them, the shell places them.
 */
export function HeaderActions({ children }: HeaderActionsProps) {
  const { actions } = useContext(HeaderSlotsContext)
  return actions ? createPortal(children, actions) : null
}
