import { Trans, useLingui } from "@lingui/react/macro"
import { DownloadIcon } from "lucide-react"
import { CopyButton } from "@/components/shared/CopyButton"
import { HighlightedCodeBlock } from "@/components/shared/HighlightedCodeBlock"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { downloadText } from "../download"
import { extractedFieldsOf, resultFileNameOf, resultJsonOf } from "../extraction-fields"
import { ResultFields } from "./ResultFields"

export type ExtractionResultProps = {
  result: Record<string, unknown>
  /** The document's name, which names the JSON file. */
  documentName: string | null
}

/**
 * What the agent read in the document: its fields, to read, or their JSON, to reuse elsewhere.
 * Both copy, and the JSON downloads as a file named after the document.
 */
export function ExtractionResult({ result, documentName }: ExtractionResultProps) {
  const { t } = useLingui()
  const fields = extractedFieldsOf(result)
  const json = resultJsonOf(result)
  const fileName = resultFileNameOf(documentName)

  if (fields.length === 0) {
    return (
      <p className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground dark:bg-card">
        <Trans>The agent found nothing to fill in in this document.</Trans>
      </p>
    )
  }

  return (
    <Tabs
      defaultValue="fields"
      className="flex flex-col gap-3 duration-300 animate-in fade-in-0 slide-in-from-bottom-1"
    >
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="fields">
            <Trans comment="The view of a result as named values">Fields</Trans>
          </TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-1">
          <CopyButton text={json} label={t`Copy the JSON`} />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t`Download ${fileName}`}
                  onClick={() => downloadText(json, fileName, "application/json")}
                />
              }
            >
              <DownloadIcon aria-hidden className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{t`Download ${fileName}`}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <TabsContent value="fields">
        <ResultFields fields={fields} />
      </TabsContent>
      <TabsContent value="json">
        <HighlightedCodeBlock code={json} language="json" title={fileName} canCopy={false} />
      </TabsContent>
    </Tabs>
  )
}
