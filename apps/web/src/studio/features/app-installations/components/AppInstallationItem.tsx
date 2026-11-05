import { Button } from "@caseai-connect/ui/shad/button"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridCard } from "@/common/components/grid/Grid"
import { buildDate } from "@/common/utils/build-date"
import type { AppInstallation } from "../app-installations.models"
import { AppPermissionsButton } from "./AppPermissionsButton"

/** Without `onRevoke`, the caller cannot revoke and the card shows no button. */
export function AppInstallationItem({
  appInstallation,
  onRevoke,
}: {
  appInstallation: AppInstallation
  onRevoke?: (appInstallationId: string) => void
}) {
  const { t } = useTranslation()
  const [isConfirmingRevoke, setIsConfirmingRevoke] = useState(false)

  return (
    <>
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {appInstallation.permissions.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                {t("appInstallations:noPermissions")}
              </span>
            ) : (
              <AppPermissionsButton
                appName={appInstallation.appName}
                permissions={appInstallation.permissions}
                kind="granted"
              />
            )}
            {onRevoke && (
              <Button variant="outline" size="sm" onClick={() => setIsConfirmingRevoke(true)}>
                {t("appInstallations:revoke.action")}
              </Button>
            )}
          </div>
        </GridCard.Body>
      </GridCard>

      {onRevoke && (
        <ConfirmDialog
          open={isConfirmingRevoke}
          title={t("appInstallations:revoke.title", { name: appInstallation.appName })}
          description={t("appInstallations:revoke.description", {
            name: appInstallation.appName,
          })}
          confirmLabel={t("appInstallations:revoke.action")}
          onCancel={() => setIsConfirmingRevoke(false)}
          onConfirm={() => {
            onRevoke(appInstallation.id)
            setIsConfirmingRevoke(false)
          }}
        />
      )}
    </>
  )
}

export function AppLogo({ appName, logoUrl }: { appName: string; logoUrl: string | null }) {
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
