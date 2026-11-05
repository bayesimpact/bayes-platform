import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { EllipsisVerticalIcon, ExternalLinkIcon, ShieldCheckIcon, UnplugIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridCard } from "@/common/components/grid/Grid"
import { AppPermissionsDialog } from "@/common/features/oauth-consent/components/AppPermissionsDialog"
import { buildDate } from "@/common/utils/build-date"
import type { AppInstallation } from "../app-installations.models"

/**
 * Without `onRevoke`, the caller cannot revoke and the card menu has no revoke item.
 * `showAppUrl` follows the apps-catalog flag: without it, the card has no link to the app.
 */
export function AppInstallationItem({
  appInstallation,
  onRevoke,
  showAppUrl = false,
}: {
  appInstallation: AppInstallation
  onRevoke?: (appInstallationId: string) => void
  showAppUrl?: boolean
}) {
  const { t } = useTranslation()
  const [isConfirmingRevoke, setIsConfirmingRevoke] = useState(false)
  const [isShowingPermissions, setIsShowingPermissions] = useState(false)
  const hasPermissions = appInstallation.permissions.length > 0

  return (
    <>
      <GridCard className="justify-start">
        <GridCard.Body>
          <div className="flex items-center gap-3 pr-8">
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
          {showAppUrl && appInstallation.appUrl && (
            <Button variant="outline" size="sm" className="mt-4 self-start" asChild>
              <a href={appInstallation.appUrl} target="_blank" rel="noopener noreferrer">
                {t("appCatalog:openApp")}
                <ExternalLinkIcon />
              </a>
            </Button>
          )}
        </GridCard.Body>
        <GridCard.TopAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={t("actions:more")}>
                <EllipsisVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Without permissions, the item says so and opens nothing. */}
              <DropdownMenuItem
                disabled={!hasPermissions}
                onSelect={() => setIsShowingPermissions(true)}
              >
                <ShieldCheckIcon className="size-4" />
                {hasPermissions
                  ? t("appInstallations:permissions.menuItem", {
                      count: appInstallation.permissions.length,
                    })
                  : t("appInstallations:noPermissions")}
              </DropdownMenuItem>
              {onRevoke && <DropdownMenuSeparator />}
              {onRevoke && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setIsConfirmingRevoke(true)}
                >
                  <UnplugIcon className="size-4" />
                  {t("appInstallations:revoke.action")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </GridCard.TopAction>
      </GridCard>

      {hasPermissions && (
        <AppPermissionsDialog
          appName={appInstallation.appName}
          permissions={appInstallation.permissions}
          kind="granted"
          open={isShowingPermissions}
          onOpenChange={setIsShowingPermissions}
        />
      )}

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
