import { createContext } from "react"

/** The elements of the shell's top bar where a page puts its parts, known once the bar is mounted. */
export type HeaderSlots = {
  /** At the start of the bar, after the sidebar's button: the link back to the page above. */
  back: HTMLElement | null
  /** At the end of the bar: the page's actions. */
  actions: HTMLElement | null
}

export const HeaderSlotsContext = createContext<HeaderSlots>({ back: null, actions: null })
