import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
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
    <Grid cols={2} total={2}>
      <GridHeader
        title={t("evaluation:dashboard.title")}
        description={t("evaluation:dashboard.description")}
      />
      <GridContent>
        <GridItem
          index={1}
          badge={t(`agent:create.typeDialog.extraction`)}
          title={t("evaluation:dashboard.evaluateExtractionAgent")}
          description={t("evaluation:dashboard.manageDatasets")}
          onClick={goToExtraction}
        />
      </GridContent>
    </Grid>
  )
}
