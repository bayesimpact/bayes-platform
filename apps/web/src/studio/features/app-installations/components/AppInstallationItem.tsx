import { Badge } from "@caseai-connect/ui/shad/badge"
import { useTranslation } from "react-i18next"
import { GridCard } from "@/common/components/grid/Grid"
import { permissionCopyKey } from "@/common/features/app-install/components/AppInstallPermissionIcon"
import { buildDate } from "@/common/utils/build-date"
import type { AppInstallation } from "../app-installations.models"

export function AppInstallationItem({ appInstallation }: { appInstallation: AppInstallation }) {
  const { t } = useTranslation()

  return (
    <GridCard className="justify-start">
      <GridCard.Body>
        <div className="flex items-center gap-3">
          <AppLogo appName={appInstallation.appName} logoUrl={appInstallation.logoUrl} />
          <div className="flex min-w-0 flex-col">
            <GridCard.Title className="truncate">{appInstallation.appName}</GridCard.Title>
            <span className="text-sm text-muted-foreground">
              {t("appInstallations:installedOn", {
                date: buildDate(appInstallation.createdAt, "d MMMM yyyy"),
              })}
            </span>
          </div>
        </div>
        {appInstallation.description && (
          <GridCard.Description className="mt-4 mb-0">
            {appInstallation.description}
          </GridCard.Description>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {appInstallation.permissions.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("appInstallations:noPermissions")}
            </span>
          ) : (
            appInstallation.permissions.map((permission) => (
              <Badge
                key={permission}
                variant="secondary"
                title={permission}
                className="h-auto max-w-full whitespace-normal rounded-md text-left"
              >
                {t(`appInstall:copy.${permissionCopyKey(permission)}.name`, {
                  defaultValue: permission,
                })}
              </Badge>
            ))
          )}
        </div>
      </GridCard.Body>
    </GridCard>
  )
}

function AppLogo({ appName, logoUrl }: { appName: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="size-10 shrink-0 rounded-lg border bg-white object-contain"
      />
    )
  }
  return (
    <div
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-base font-medium text-muted-foreground"
    >
      {appName.charAt(0).toUpperCase()}
    </div>
  )
}
