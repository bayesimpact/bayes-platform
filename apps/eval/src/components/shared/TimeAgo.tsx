import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/app-ui/components/tooltip"
import {
  fullDateTimeOf,
  RELATIVE_TIME_INTERVAL_IN_MILLISECONDS,
  useNow,
} from "@caseai-connect/frontend-lib"
import { useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { timeAgoOf } from "@/lib/time-ago"

export type TimeAgoProps = {
  /** When it happened, in epoch milliseconds. */
  moment: number
  className?: string
}

/**
 * When something happened, as "5 minutes ago", with the full date and time on hover: how the app
 * shows a date in a table or under a title. It follows the clock by itself, a minute at a time,
 * and words the time with date-fns.
 */
export function TimeAgo({ moment, className }: TimeAgoProps) {
  const { i18n } = useLingui()
  const now = useNow(RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, true)
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
        {timeAgoOf(moment, now, i18n.locale)}
      </TooltipTrigger>
      <TooltipContent>{fullDateTimeOf(moment, i18n.locale)}</TooltipContent>
    </Tooltip>
  )
}
