import { Button } from "@caseai-connect/ui/shad/button"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { Evaluation } from "@/studio/features/evaluations/evaluations.models"
import { selectEvaluationsData } from "@/studio/features/evaluations/evaluations.selectors"
import { createEvaluation } from "@/studio/features/evaluations/evaluations.thunks"
import { GridHeader } from "../../common/components/grid/Grid"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { EmptyEvaluation } from "../features/evaluations/components/EmptyEvaluation"
import { EvaluationCreator } from "../features/evaluations/components/EvaluationCreator"
import { EvaluationExtractionRunner } from "../features/evaluations/components/EvaluationExtractionRunner"
import { EvaluationItem } from "../features/evaluations/components/EvaluationItem"
import { evaluationsActions } from "../features/evaluations/evaluations.slice"

export function EvaluationRoute() {
  const evaluations = useAppSelector(selectEvaluationsData)
  const agents = useAppSelector(selectAgentsData)
  useMount({ actions: evaluationsActions })
  return (
    <AsyncRoute data={[agents, evaluations]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const agents = useValue(selectAgentsData)
  const evaluations = useValue(selectEvaluationsData)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const projectRoute = useGetProjectRoute()
  const [idsToRun, setIdsToRun] = useState<string[]>([])

  const handleCreate = useCallback(
    (fields: Pick<Evaluation, "input" | "expectedOutput">) => {
      dispatch(createEvaluation({ fields }))
    },
    [dispatch],
  )

  const handleBack = () => navigate(projectRoute)

  return (
    <>
      <GridHeader
        onBack={handleBack}
        title={t("evaluation:evaluations")}
        description={t("evaluation:list.description")}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <EvaluationCreator onSubmit={handleCreate} />
            <Button
              variant="outline"
              disabled={evaluations.length === 0}
              onClick={() => setIdsToRun(evaluations.map((e) => e.id))}
            >
              {t("evaluation:runAll")}
            </Button>
            <EvaluationExtractionRunner
              ids={idsToRun}
              agents={agents}
              modalHandler={{
                open: idsToRun.length > 0,
                setOpen: (open) => {
                  if (!open) setIdsToRun([])
                },
              }}
            />
          </div>
        }
      />
      {evaluations.length === 0 ? (
        <EmptyEvaluation />
      ) : (
        <div className="p-6 flex flex-col gap-4">
          {evaluations.map((evaluation) => (
            <EvaluationItem key={evaluation.id} evaluation={evaluation} agents={agents} />
          ))}
        </div>
      )}
    </>
  )
}
