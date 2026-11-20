import { useRef, useState } from "react"

/** How long a copy button shows that the text was copied. */
const COPIED_FEEDBACK_IN_MILLISECONDS = 2000

/**
 * Copies a text to the clipboard. `isCopied` stays true a moment after, so the button that copied
 * can show a check.
 */
export function useCopyText() {
  const [isCopied, setIsCopied] = useState(false)
  // The timer of the last copy, so a new copy keeps the check its full time.
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_IN_MILLISECONDS)
    } catch (error) {
      // The browser can refuse the clipboard (no focus, no permission): nothing else to do.
      console.error("The text could not be copied:", error)
    }
  }

  return { isCopied, copy }
}
