import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckIcon, ExternalLinkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { GridCard } from "@/common/components/grid/Grid"
import { AppPermissionsButton } from "@/common/features/oauth-consent/components/AppPermissionsDialog"
import { AppLogo } from "@/studio/features/app-installations/components/AppInstallationItem"
import type { AppCatalogEntry } from "../app-catalog.models"

/** Without `canInstall`, the card leaves out the link to the app: installing it would fail. */
export function AppCatalogItem({
  entry,
  canInstall,
}: {
  entry: AppCatalogEntry
  canInstall: boolean
}) {
  const { t } = useTranslation()
  const appLink = !entry.installed && canInstall ? entry.appUrl : null

  return (
    <GridCard className="justify-start">
      <GridCard.Body>
        <div className="flex items-center gap-3">
          <AppLogo appName={entry.name} logoUrl={entry.logoUrl} />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <GridCard.Title className="max-w-full truncate">{entry.name}</GridCard.Title>
            {entry.installed && (
              <Badge variant="secondary">
                <CheckIcon />
                {t("appCatalog:connected")}
              </Badge>
            )}
          </div>
        </div>
        {entry.description && (
          <GridCard.Description className="mt-4 mb-0">{entry.description}</GridCard.Description>
        )}
        {!entry.installed && entry.installInstructions && (
          <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
            {entry.installInstructions}
          </p>
        )}
        {(appLink || entry.grantablePermissions.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {entry.grantablePermissions.length > 0 && (
              <AppPermissionsButton
                appName={entry.name}
                permissions={entry.grantablePermissions}
                kind="requested"
              />
            )}
            {appLink && (
              <Button variant="outline" size="sm" asChild>
                <a href={appLink} target="_blank" rel="noopener noreferrer">
                  {t("appCatalog:openApp")}
                  <ExternalLinkIcon />
                </a>
              </Button>
            )}
          </div>
        )}
      </GridCard.Body>
    </GridCard>
  )
}
