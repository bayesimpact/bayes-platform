import { Kbd } from "@caseai-connect/app-ui/components/kbd"
import { Trans } from "@lingui/react/macro"
import { CornerDownLeftIcon } from "lucide-react"

export type EnterKeyProps = {
  className?: string
}

/** The Enter key, drawn as ↵, and named for screen readers. */
export function EnterKey({ className }: EnterKeyProps) {
  return (
    <Kbd className={className}>
      <CornerDownLeftIcon aria-hidden />
      <span className="sr-only">
        <Trans comment="The keyboard key">Enter</Trans>
      </span>
    </Kbd>
  )
}
