import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { useExtractionPath } from "../hooks/use-extraction-path"

export function Dashboard() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const outlet = useOutlet()

  const { buildExtractionPath } = useExtractionPath()
  const goToExtraction = () => {
    const path = buildExtractionPath()
    navigate(path)
  }
  if (outlet) return outlet
  return (
    <Grid cols={2}>
      <GridHeader
        title={t("evaluation:dashboard.title")}
        description={t("evaluation:dashboard.description")}
      />
      <GridContent>
        <GridCard>
          <GridCard.Badge>{t(`agent:create.typeDialog.extraction`)}</GridCard.Badge>
          <GridCard.Body>
            <GridCard.Title>{t("evaluation:dashboard.evaluateExtractionAgent")}</GridCard.Title>
            <GridCard.Description>{t("evaluation:dashboard.manageDatasets")}</GridCard.Description>
            <GridCard.GoButton onClick={goToExtraction} />
          </GridCard.Body>
        </GridCard>
      </GridContent>
    </Grid>
  )
}
