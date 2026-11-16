import { ZapIcon } from "lucide-react"
import { Trans } from "react-i18next"

/**
 * Marks a setting of the editor that is not part of the draft: the API saves it on the agent
 * itself, so a change applies in production at once and no version holds it.
 */
export function LiveSettingNotice() {
  return (
    <p className="flex items-center gap-1.5 text-amber-700 text-sm dark:text-amber-400">
      <ZapIcon className="size-3.5 shrink-0" />
      <span>
        <Trans
          i18nKey="agentSettings:liveSettings.immediate"
          components={{ strong: <strong className="font-semibold" /> }}
        />
      </span>
    </p>
  )
}
