import { Trans } from "@lingui/react/macro"
import { ArrowBigUpIcon } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"

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
