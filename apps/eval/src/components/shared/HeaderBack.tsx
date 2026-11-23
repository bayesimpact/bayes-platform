import { type ReactNode, useContext } from "react"
import { createPortal } from "react-dom"
import { HeaderSlotsContext } from "./header-slots-context"

export type HeaderBackProps = {
  children: ReactNode
}

/** Puts a page's link back to the page above at the start of the shell's top bar. */
export function HeaderBack({ children }: HeaderBackProps) {
  const { back } = useContext(HeaderSlotsContext)
  return back ? createPortal(children, back) : null
}
