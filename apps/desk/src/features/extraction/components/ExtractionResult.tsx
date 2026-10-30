import { Trans } from "@lingui/react/macro"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { extractedFieldsOf, resultFileNameOf, resultJsonOf } from "../extraction-fields"
import { ResultFields } from "./ResultFields"
import { ResultFileActions } from "./ResultFileActions"
import { ResultJson } from "./ResultJson"

export type ExtractionResultProps = {
  result: Record<string, unknown>
  /** The document's name, which names the JSON file. */
  documentName: string | null
}

/**
 * What the agent read in the document: its fields, to read, or their JSON, to reuse elsewhere.
 * Both copy, and the JSON downloads as a file named after the document: beside the tabs for the
 * fields, in the header of the code for the JSON.
 */
export function ExtractionResult({ result, documentName }: ExtractionResultProps) {
  const [tab, setTab] = useState("fields")
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
      value={tab}
      onValueChange={setTab}
      className="flex flex-col gap-3 duration-300 animate-in fade-in-0 slide-in-from-bottom-1"
    >
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="fields">
            <Trans comment="The view of a result as named values">Fields</Trans>
          </TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        {tab === "fields" ? (
          <div className="flex items-center gap-1">
            <ResultFileActions json={json} fileName={fileName} />
          </div>
        ) : null}
      </div>
      <TabsContent value="fields">
        <ResultFields fields={fields} />
      </TabsContent>
      <TabsContent value="json">
        <ResultJson json={json} fileName={fileName} />
      </TabsContent>
    </Tabs>
  )
}
