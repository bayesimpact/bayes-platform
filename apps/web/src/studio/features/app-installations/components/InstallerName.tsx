import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { MailIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { AppInstaller } from "@/common/features/app-installers/app-installers.models"
import { useInstallerLabel } from "@/common/features/app-installers/components/use-installer-label"
import { useInstallerMailLink } from "@/common/features/app-installers/components/use-installer-mail-link"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useValue } from "@/common/hooks/use-value"

const HIGHLIGHT = "font-medium text-foreground"

/**
 * Who connected an app, inside the card's subtitle. "You" stands out. A colleague or a former
 * member also opens a small card: how to reach the colleague, or who can reconnect the app instead.
 */
export function InstallerName({
  installer,
  appName,
  children,
}: {
  installer: AppInstaller
  appName: string
  /** The label, as the translation renders it. */
  children?: ReactNode
}) {
  const { t } = useTranslation("appInstallations")
  const installerLabel = useInstallerLabel()
  const mailLink = useInstallerMailLink()
  const project = useValue(selectCurrentProjectData)
  const label = children ?? installerLabel(installer)

  if (installer.kind === "me") return <span className={HIGHLIGHT}>{label}</span>

  return (
    <Popover>
      <PopoverTrigger
        className={`${HIGHLIGHT} cursor-pointer whitespace-nowrap underline decoration-dotted underline-offset-2 hover:decoration-solid`}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-sm">
        {installer.kind === "member" ? (
          <div className="flex flex-col gap-1">
            {installer.name && <span className="font-medium">{installer.name}</span>}
            <a
              href={mailLink(installer, { appName, workspaceName: project.name })}
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <MailIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{installer.email}</span>
            </a>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("installer.memberHint", { name: appName })}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            {t("installer.formerMemberHint", { name: appName })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
