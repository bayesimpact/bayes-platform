import type { ConversationDatasetRecordInputDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { parseBulkRecords } from "../bulk-records"

export type BulkRecordsDialogProps = {
  isPending: boolean
  onSubmit: (records: ConversationDatasetRecordInputDto[]) => void
  onClose: () => void
}

/**
 * Adds several records from pasted lines, one record per line: the input, a comma, the expected
 * output. It says which lines make no record before anything is added. Its owner mounts it while
 * it shows.
 */
export function BulkRecordsDialog({ isPending, onSubmit, onClose }: BulkRecordsDialogProps) {
  const { t, i18n } = useLingui()
  const linesId = useId()
  const [text, setText] = useState("")
  const { records, invalidLines, tooLongLines } = parseBulkRecords(text)
  const lineList = new Intl.ListFormat(i18n.locale, { type: "conjunction" })
  const listOf = (lines: number[]) => lineList.format(lines.map(String))
  const invalidList = listOf(invalidLines)
  const tooLongList = listOf(tooLongLines)
  const hasProblem = invalidLines.length > 0 || tooLongLines.length > 0
  const recordCount = records.length
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <Trans>Bulk add records</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Paste one record per line: the input, a comma, then the expected output.</Trans>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!hasProblem && recordCount > 0) onSubmit(records)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <Field data-invalid={hasProblem}>
            <FieldLabel htmlFor={linesId}>
              <Trans comment="The pasted lines that become the records of a dataset">Records</Trans>
            </FieldLabel>
            <Textarea
              id={linesId}
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t`Can we switch plan later?, Yes, at any time, from the billing page.`}
              className="max-h-80 min-h-40 font-mono"
              aria-invalid={hasProblem}
            />
            <FieldDescription>
              <Trans>
                The first comma of a line ends the input: the expected output keeps its own.
              </Trans>
            </FieldDescription>
            {invalidLines.length > 0 ? (
              <FieldError>
                <Plural
                  value={invalidLines.length}
                  one={`Line ${invalidList} has no input or no expected output.`}
                  other={`Lines ${invalidList} have no input or no expected output.`}
                />
              </FieldError>
            ) : null}
            {tooLongLines.length > 0 ? (
              <FieldError>
                <Plural
                  value={tooLongLines.length}
                  one={`Line ${tooLongList} is too long.`}
                  other={`Lines ${tooLongList} are too long.`}
                />
              </FieldError>
            ) : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={isPending || hasProblem || recordCount === 0}>
              {recordCount === 0 ? (
                <Trans>Add records</Trans>
              ) : (
                <Plural value={recordCount} one="Add # record" other="Add # records" />
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
