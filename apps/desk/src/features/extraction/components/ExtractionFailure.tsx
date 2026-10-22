import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { CircleAlertIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

/** The errors that a new try would meet again, which then offer none. */
const LASTING_ERRORS = new Set(["PDF_PAGE_LIMIT_EXCEEDED"])

/** What each error code of the API means to the person. */
const REASONS: Record<string, MessageDescriptor> = {
  PDF_PAGE_LIMIT_EXCEEDED: msg`The document has more pages than the agent can read at once. Split it, then extract each part.`,
  SCHEMA_VALIDATION_FAILED: msg`The agent's answer did not fit the fields it fills in. Extracting again often works.`,
  EXTRACTION_PROVIDER_ERROR: msg`The model that reads the document did not answer. Try again in a moment.`,
}

export type ExtractionFailureProps = {
  errorCode: string | null
  /** The API's own words on the error, for the curious and for support. */
  detail: string | null
  isRetrying: boolean
  onRetry: () => void
}

/** Why the extraction failed, in the person's words, and a way to try again. */
export function ExtractionFailure({
  errorCode,
  detail,
  isRetrying,
  onRetry,
}: ExtractionFailureProps) {
  const { i18n } = useLingui()
  const reason = errorCode ? REASONS[errorCode] : undefined
  return (
    <section
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <div className="flex items-start gap-3">
        <CircleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            <Trans>The agent could not read the document</Trans>
          </p>
          <p className="text-sm text-muted-foreground">
            {reason ? (
              i18n._(reason)
            ) : (
              <Trans>Something went wrong while it read it. Try again.</Trans>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-8">
        {errorCode && LASTING_ERRORS.has(errorCode) ? null : (
          <Button size="sm" onClick={onRetry} disabled={isRetrying}>
            <RotateCcwIcon data-icon="inline-start" aria-hidden />
            <Trans>Try again</Trans>
          </Button>
        )}
        {detail ? (
          <Collapsible className="w-full">
            <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              <Trans comment="Shows the API's own words on why the extraction failed">
                Details
              </Trans>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 rounded-lg bg-muted p-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                {errorCode ? `${errorCode}: ${detail}` : detail}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </section>
  )
}
