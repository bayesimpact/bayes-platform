import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fullDateTimeOf, relativeTimeOf } from "@/lib/relative-time"

export type RelativeTimeProps = {
  moment: number
  now: number
  className?: string
}

/** When something happened, as "just now" or "5 minutes ago", with the full date on hover. */
export function RelativeTime({ moment, now, className }: RelativeTimeProps) {
  const { i18n } = useLingui()
  const relative = relativeTimeOf(moment, now, i18n.locale)
  const full = fullDateTimeOf(moment, i18n.locale)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={new Date(moment).toISOString()}
            className={cn("cursor-default text-muted-foreground", className)}
          />
        }
      >
        {relative ?? (
          <Trans comment="Something that happened less than a minute ago">just now</Trans>
        )}
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  )
}
