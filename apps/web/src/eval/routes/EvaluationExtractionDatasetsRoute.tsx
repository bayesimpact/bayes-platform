import { useOutlet } from "react-router-dom"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { EvaluationExtractionDatasetList } from "../features/evaluation-extraction-datasets/components/EvaluationExtractionDatasetList"
import {
  selectDatasetsData,
  selectFilesData,
} from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.selectors"
import { evaluationExtractionDatasetsActions } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.slice"

export function EvaluationExtractionDatasetsRoute() {
  const filesData = useAppSelector(selectFilesData)
  const datasetsData = useAppSelector(selectDatasetsData)

  useMount({ actions: evaluationExtractionDatasetsActions })

  return (
    <AsyncRoute data={[filesData, datasetsData]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const datasets = useValue(selectDatasetsData)
  const outlet = useOutlet()
  if (outlet) return outlet
  return <EvaluationExtractionDatasetList datasets={datasets} />
}
