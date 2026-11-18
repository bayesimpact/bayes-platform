import { Trans, useLingui } from "@lingui/react/macro"
import { CheckIcon, CopyIcon, MessageSquarePlusIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useCopyText } from "@/hooks/use-copy-text"

export type SelectionActionsProps = {
  /** The passage the person selected. */
  passage: string
  /** Opens the note on the passage. */
  onAnnotate: () => void
}

/**
 * What a selected passage of a reply offers: copy it, with a check once it is in the clipboard,
 * or annotate it. The box leaves the focus on the page, which keeps the selection: Tab brings the
 * focus into it.
 */
export function SelectionActions({ passage, onAnnotate }: SelectionActionsProps) {
  const { t } = useLingui()
  const { isCopied, copy } = useCopyText()
  const actionsRef = useRef<HTMLDivElement>(null)

  // The keyboard lives in the browser, outside React, which an effect follows.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const actions = actionsRef.current
      if (event.key !== "Tab" || event.shiftKey || !actions) return
      if (actions.contains(document.activeElement)) return
      event.preventDefault()
      actions.querySelector("button")?.focus()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div ref={actionsRef} className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={() => void copy(passage)}>
        {isCopied ? (
          <>
            <CheckIcon data-icon="inline-start" aria-hidden />
            {t({ message: "Copied", comment: "The copy button, once it copied its text" })}
          </>
        ) : (
          <>
            <CopyIcon data-icon="inline-start" aria-hidden />
            {t({ message: "Copy", comment: "Copies the passage of a reply the person selected" })}
          </>
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={onAnnotate}>
        <MessageSquarePlusIcon data-icon="inline-start" aria-hidden />
        <Trans comment="Opens a note on the passage of a reply the person selected">Annotate</Trans>
      </Button>
    </div>
  )
}
