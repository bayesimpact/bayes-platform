import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { InfoIcon, LayoutGridIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type { AppCatalogEntry } from "../app-catalog.models"
import { AppCatalogItem } from "./AppCatalogItem"

export function AppCatalogList({
  entries,
  canInstall,
  onBack,
}: {
  entries: AppCatalogEntry[]
  canInstall: boolean
  onBack: () => void
}) {
  const { t } = useTranslation()

  return (
    <Grid cols={entries.length === 0 ? 0 : 3}>
      <GridHeader
        onBack={onBack}
        title={t("appCatalog:title")}
        description={t("appCatalog:description")}
      />
      {!canInstall && entries.length > 0 && (
        <div className="px-4 pt-4 sm:px-6 sm:pt-6">
          <Alert>
            <InfoIcon />
            <AlertTitle>{t("appCatalog:askToInstall.title")}</AlertTitle>
            <AlertDescription>{t("appCatalog:askToInstall.description")}</AlertDescription>
          </Alert>
        </div>
      )}
      <GridContent>
        {entries.length === 0 ? (
          <GridCard span="full">
            <Empty className="w-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LayoutGridIcon />
                </EmptyMedia>
                <EmptyTitle>{t("appCatalog:empty.title")}</EmptyTitle>
                <EmptyDescription>{t("appCatalog:empty.description")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </GridCard>
        ) : (
          entries.map((entry) => (
            <AppCatalogItem key={entry.id} entry={entry} canInstall={canInstall} />
          ))
        )}
      </GridContent>
    </Grid>
  )
}
