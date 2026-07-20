import { useOutlet } from "react-router-dom"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { EvaluationConversationDatasetList } from "../features/evaluation-conversation-datasets/components/EvaluationConversationDatasetList"
import { selectConversationDatasetsData } from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.selectors"
import { evaluationConversationDatasetsActions } from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"

export function EvaluationConversationDatasetsRoute() {
  const datasetsData = useAppSelector(selectConversationDatasetsData)

  useMount({ actions: evaluationConversationDatasetsActions })

  return (
    <AsyncRoute data={[datasetsData]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const datasets = useValue(selectConversationDatasetsData)
  const outlet = useOutlet()
  if (outlet) return outlet
  return <EvaluationConversationDatasetList datasets={datasets} />
}
