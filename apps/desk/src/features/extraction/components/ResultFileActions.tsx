import { Button } from "@caseai-connect/app-ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/app-ui/components/tooltip"
import { CopyButton } from "@caseai-connect/app-ui/compositions/CopyButton"
import { Trans, useLingui } from "@lingui/react/macro"
import { DownloadIcon } from "lucide-react"
import { downloadText } from "../download"

export type ResultFileActionsProps = {
  json: string
  fileName: string
}

/** Copies the JSON of a result, or downloads it as a file named after the document. */
export function ResultFileActions({ json, fileName }: ResultFileActionsProps) {
  const { t } = useLingui()
  return (
    <>
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
        <TooltipContent>
          <Trans>Download {fileName}</Trans>
        </TooltipContent>
      </Tooltip>
    </>
  )
}
