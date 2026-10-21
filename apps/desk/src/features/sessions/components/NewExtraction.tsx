import { Trans } from "@lingui/react/macro"
import { FileUpIcon } from "lucide-react"

export type NewExtractionProps = {
  agentName: string
}

/**
 * A new extraction, before its document: the place to drop it. Uploading comes in a next change:
 * the zone is shown but inactive.
 */
export function NewExtraction({ agentName }: NewExtractionProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        <Trans>What should {agentName} read?</Trans>
      </h1>
      <div
        aria-disabled="true"
        className="flex w-full max-w-2xl flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center text-muted-foreground"
      >
        <FileUpIcon aria-hidden className="size-8" />
        <p className="text-sm font-medium text-foreground">
          <Trans>Drop a document or a CSV file here</Trans>
        </p>
        <p className="text-xs">
          <Trans>Uploading comes in the next version of the Desk.</Trans>
        </p>
      </div>
    </div>
  )
}
