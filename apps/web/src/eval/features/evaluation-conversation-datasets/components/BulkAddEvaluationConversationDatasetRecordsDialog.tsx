import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { UploadIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "../evaluation-conversation-datasets.slice"

type ParsedRecord = { input: string; expectedOutput: string }
type ParseResult = { records: ParsedRecord[]; invalidLines: number[] }

/**
 * Parses pasted CSV rows: one record per line, input and expected output separated by a comma. The
 * split is on the first comma only, so the expected output may itself contain commas. Blank lines
 * are skipped; a line whose input or expected output is empty is reported as invalid by its 1-based
 * line number.
 */
function parseBulkRecords(raw: string): ParseResult {
  const records: ParsedRecord[] = []
  const invalidLines: number[] = []
  raw.split("\n").forEach((line, lineIndex) => {
    if (line.trim() === "") return
    const separatorIndex = line.indexOf(",")
    const rawInput = separatorIndex === -1 ? line : line.slice(0, separatorIndex)
    const rawExpectedOutput = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1)
    const input = rawInput.trim()
    const expectedOutput = rawExpectedOutput.trim()
    if (input === "" || expectedOutput === "") {
      invalidLines.push(lineIndex + 1)
      return
    }
    records.push({ input, expectedOutput })
  })
  return { records, invalidLines }
}

export function BulkAddEvaluationConversationDatasetRecordsDialog({
  datasetId,
}: {
  datasetId: string
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")

  const { records, invalidLines } = useMemo(() => parseBulkRecords(text), [text])
  const canSubmit = records.length > 0 && invalidLines.length === 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    await dispatch(
      evaluationConversationDatasetsActions.createRecords({ datasetId, records }),
    ).unwrap()
    setText("")
    setOpen(false)
  }

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setText("")
      }}
    >
      <DialogTrigger asChild>
        <Button>
          {t("evaluationConversationDataset:record.bulk.button")}
          <UploadIcon className="ml-2 size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("evaluationConversationDataset:record.bulk.title")}</DialogTitle>
          <DialogDescription>
            {t("evaluationConversationDataset:record.bulk.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-4">
          <Textarea
            rows={10}
            className="font-mono text-xs"
            placeholder={t("evaluationConversationDataset:record.bulk.placeholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {invalidLines.length > 0 ? (
            <p className="text-sm text-destructive">
              {t("evaluationConversationDataset:record.bulk.invalidRows", {
                lines: invalidLines.join(", "),
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("evaluationConversationDataset:record.bulk.parsedCount", {
                count: records.length,
              })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {t("actions:add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
