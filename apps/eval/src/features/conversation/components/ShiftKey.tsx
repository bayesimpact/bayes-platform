import { Kbd } from "@caseai-connect/app-ui/components/kbd"
import { Trans } from "@lingui/react/macro"
import { ArrowBigUpIcon } from "lucide-react"

/** The Shift key, drawn as ⇧, and named for screen readers. */
export function ShiftKey() {
  return (
    <Kbd>
      <ArrowBigUpIcon aria-hidden />
      <span className="sr-only">
        <Trans comment="The keyboard key">Shift</Trans>
      </span>
    </Kbd>
  )
}
