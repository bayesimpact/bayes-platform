import { GlobeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { GridCard } from "@/common/components/grid/Grid"
import { permissionCopyKey } from "@/common/features/app-install/components/AppInstallPermissionIcon"
import { buildDate } from "@/common/utils/build-date"
import type { AppInstallation } from "../app-installations.models"

export function AppInstallationItem({ appInstallation }: { appInstallation: AppInstallation }) {
  const { t } = useTranslation()

  return (
    <GridCard>
      <GridCard.Body>
        <div className="flex items-center gap-3">
          <AppLogo logoUrl={appInstallation.logoUrl} />
          <GridCard.Title>{appInstallation.appName}</GridCard.Title>
        </div>
        {appInstallation.description && (
          <p className="text-sm text-muted-foreground leading-snug mt-2">
            {appInstallation.description}
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5 mt-4">
          {appInstallation.permissions.length === 0 ? (
            <li className="text-sm text-muted-foreground italic">
              {t("appInstallations:noPermissions")}
            </li>
          ) : (
            appInstallation.permissions.map((permission) => (
              <li
                key={permission}
                title={permission}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {t(`appInstall:copy.${permissionCopyKey(permission)}.name`, {
                  defaultValue: permission,
                })}
              </li>
            ))
          )}
        </ul>
      </GridCard.Body>
      <GridCard.Footer>
        <p className="text-xs text-muted-foreground">
          {t("appInstallations:installedOn", {
            date: buildDate(appInstallation.createdAt, "dd MMMM yyyy"),
          })}
        </p>
      </GridCard.Footer>
    </GridCard>
  )
}

function AppLogo({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="size-8 shrink-0 rounded-md border bg-muted object-contain"
      />
    )
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
      <GlobeIcon className="size-4" aria-hidden />
    </div>
  )
}
