import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { PlugIcon } from "lucide-react"
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
            <Empty className="w-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PlugIcon />
                </EmptyMedia>
                <EmptyTitle>{t("appInstallations:empty.title")}</EmptyTitle>
                <EmptyDescription>{t("appInstallations:empty.description")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
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
