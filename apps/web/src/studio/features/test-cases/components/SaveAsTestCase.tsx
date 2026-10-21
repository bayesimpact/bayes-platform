import { useState } from "react"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectConversationDatasetsData } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.selectors"
import type { TestCaseSource } from "../test-cases.models"
import {
  anonymizeTestCaseText,
  draftTestCaseExpectedOutput,
  draftTestCaseInput,
  saveTestCase,
} from "../test-cases.thunks"
import { SaveAsTestCaseButton } from "./SaveAsTestCaseButton"
import { SaveAsTestCaseDialog } from "./SaveAsTestCaseDialog"

/**
 * The Save as test case action on an agent answer, wired to the API. It shows only to people who
 * can change the project's datasets, once the route has loaded them, and only when there is a
 * dataset to pick or the right to create one.
 */
export function SaveAsTestCase({
  source,
  withLabel = false,
}: {
  source: TestCaseSource
  withLabel?: boolean
}) {
  const dispatch = useAppDispatch()
  const projectId = useAppSelector(selectCurrentProjectId)
  const datasets = useAppSelector(selectConversationDatasetsData)
  const { abilities } = useAbility()
  const [open, setOpen] = useState(false)

  const canCreateDataset = abilities.canCreateEvaluationDataset({ projectId })
  const datasetList = ADS.isFulfilled(datasets) ? datasets.value : null
  if (!abilities.canSaveTestCase({ projectId })) return null
  if (datasetList?.length === 0 && !canCreateDataset) return null

  const { agentMessageId } = source
  return (
    <>
      <SaveAsTestCaseButton
        withLabel={withLabel}
        disabled={!datasetList}
        onClick={() => setOpen(true)}
      />
      {datasetList && (
        <SaveAsTestCaseDialog
          open={open}
          onOpenChange={setOpen}
          source={source}
          datasets={datasetList}
          canCreateDataset={canCreateDataset}
          onDraftInput={(inputMode) =>
            dispatch(draftTestCaseInput({ agentMessageId, inputMode })).unwrap()
          }
          onDraftExpectedOutput={(comment) =>
            dispatch(draftTestCaseExpectedOutput({ agentMessageId, comment })).unwrap()
          }
          onAnonymize={(text) => dispatch(anonymizeTestCaseText({ agentMessageId, text })).unwrap()}
          onSave={async (testCase, datasetName) => {
            await dispatch(saveTestCase({ testCase, datasetName })).unwrap()
          }}
        />
      )}
    </>
  )
}
