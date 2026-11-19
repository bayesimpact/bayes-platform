import type { ConversationRunRecordOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { ExternalLink } from "@/components/shared/ExternalLink"
import { Markdown } from "@/components/shared/Markdown"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { RunRecordScore } from "./RunRecordScore"

export type RunRecordSheetProps = {
  /** The record to read, or `null` while the sheet is closed. */
  record: ConversationRunRecordOutputDto | null
  onClose: () => void
}

/** A block of the sheet: its name, then its text. */
function Block({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">{children}</div>
    </section>
  )
}

/**
 * A record of a run, whole and easy to read, which the table shortens: the input, the expected
 * output and the agent's answer, the last two rendered from Markdown, with the score, the error
 * that stopped it and the trace of the answer.
 */
export function RunRecordSheet({ record, onClose }: RunRecordSheetProps) {
  return (
    <Sheet
      open={record !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>
            <Trans comment="The title of the sheet that shows one result of a run">Result</Trans>
          </SheetTitle>
          <SheetDescription>
            <Trans>What the agent got, what it should answer, and what it answered.</Trans>
          </SheetDescription>
        </SheetHeader>
        {record ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">
                <Trans comment="The score the judge gave an answer">Score</Trans>
              </span>
              <RunRecordScore record={record} />
              {record.traceUrl ? (
                <ExternalLink href={record.traceUrl} className="ml-auto inline-flex gap-1 text-sm">
                  <Trans comment="A link to the trace of the agent's answer">Open the trace</Trans>
                </ExternalLink>
              ) : null}
            </div>
            <Block title={<Trans comment="What an evaluation sends to the agent">Input</Trans>}>
              <p className="whitespace-pre-wrap wrap-anywhere">{record.input}</p>
            </Block>
            <Block
              title={
                <Trans comment="The answer an evaluation expects from the agent">
                  Expected output
                </Trans>
              }
            >
              <Markdown>{record.expectedOutput}</Markdown>
            </Block>
            <Block title={<Trans comment="What the agent answered in a run">Agent's answer</Trans>}>
              {record.output ? (
                <Markdown>{record.output}</Markdown>
              ) : (
                <p className="text-muted-foreground">
                  <Trans comment="A record of a run with no answer from the agent">
                    No answer.
                  </Trans>
                </p>
              )}
            </Block>
            {record.status === "error" ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-destructive">
                  <Trans comment="The title of the error that stopped a record of a run">
                    Error
                  </Trans>
                </h3>
                <p className="rounded-lg border border-destructive/30 p-3 text-sm whitespace-pre-wrap wrap-anywhere text-destructive">
                  {record.errorDetails ?? "–"}
                </p>
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
