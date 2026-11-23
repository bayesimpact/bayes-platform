import { useState } from "react"
import { useMediaQuery } from "./use-media-query"

/** Tailwind's `lg`, from which a side panel docks beside the page. */
const DOCKED_QUERY = "(min-width: 64rem)"

/**
 * A side panel the page shows from the start where it has room beside it, and that the person
 * opens and closes. Their choice then holds, whatever the window's width.
 */
export function useSidePanel(roomyQuery: string = DOCKED_QUERY) {
  const hasRoom = useMediaQuery(roomyQuery)
  const [choice, setChoice] = useState<boolean | null>(null)
  const isOpen = choice ?? hasRoom
  return {
    isOpen,
    /** A panel the person opened takes the focus; one the page shows from the start does not. */
    takesFocus: choice === true,
    toggle: () => setChoice(!isOpen),
    close: () => setChoice(false),
  }
}
