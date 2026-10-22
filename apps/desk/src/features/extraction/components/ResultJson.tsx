import { FileJsonIcon } from "lucide-react"
import { HighlightedCodeBlock } from "@/components/shared/HighlightedCodeBlock"
import { ResultFileActions } from "./ResultFileActions"

export type ResultJsonProps = {
  json: string
  fileName: string
}

/**
 * The JSON of a result, as a document: numbered lines, which can wrap, and a long result
 * shortened until the person asks for the rest. Its header copies and downloads it.
 */
export function ResultJson({ json, fileName }: ResultJsonProps) {
  return (
    <HighlightedCodeBlock
      code={json}
      language="json"
      title={
        <>
          <FileJsonIcon aria-hidden />
          {fileName}
        </>
      }
      actions={<ResultFileActions json={json} fileName={fileName} />}
      canWrap
      isCollapsible
    />
  )
}
