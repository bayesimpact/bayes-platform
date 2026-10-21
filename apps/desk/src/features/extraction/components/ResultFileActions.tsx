import { useLingui } from "@lingui/react/macro"
import { DownloadIcon } from "lucide-react"
import { CopyButton } from "@/components/shared/CopyButton"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
        <TooltipContent>{t`Download ${fileName}`}</TooltipContent>
      </Tooltip>
    </>
  )
}
