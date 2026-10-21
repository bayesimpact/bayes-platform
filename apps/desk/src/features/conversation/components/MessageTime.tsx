import { Trans, useLingui } from "@lingui/react/macro"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fullDateTimeOf, relativeTimeOf } from "../relative-time"

export type MessageTimeProps = {
  createdAt: number
  now: number
}

/** When a reply was written, as "just now" or "5 minutes ago", with the full date on hover. */
export function MessageTime({ createdAt, now }: MessageTimeProps) {
  const { i18n } = useLingui()
  const relative = relativeTimeOf(createdAt, now, i18n.locale)
  const full = fullDateTimeOf(createdAt, i18n.locale)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={new Date(createdAt).toISOString()}
            className="cursor-default px-1 text-xs font-normal text-muted-foreground"
          />
        }
      >
        {relative ?? <Trans comment="A reply written less than a minute ago">just now</Trans>}
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  )
}
