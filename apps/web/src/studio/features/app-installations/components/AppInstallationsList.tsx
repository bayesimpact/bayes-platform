import { useTranslation } from "react-i18next"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type { AppInstallation } from "../app-installations.models"
import { AppInstallationItem } from "./AppInstallationItem"

export function AppInstallationsList({
  appInstallations,
  onBack,
  onRevoke,
}: {
  appInstallations: AppInstallation[]
  onBack: () => void
  onRevoke?: (appInstallationId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <Grid cols={appInstallations.length === 0 ? 0 : 3}>
      <GridHeader
        onBack={onBack}
        title={t("appInstallations:title")}
        description={t("appInstallations:description")}
      />
      <GridContent>
        {appInstallations.length === 0 ? (
          <GridCard span="full">
            <GridCard.Body>
              <GridCard.Description>{t("appInstallations:empty")}</GridCard.Description>
            </GridCard.Body>
          </GridCard>
        ) : (
          appInstallations.map((appInstallation) => (
            <AppInstallationItem
              key={appInstallation.id}
              appInstallation={appInstallation}
              onRevoke={onRevoke}
            />
          ))
        )}
      </GridContent>
    </Grid>
  )
}
