import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  selectBackofficeProjectDetail,
  selectCustomModels,
  selectProjectModels,
} from "../../backoffice.selectors"
import { backofficeActions } from "../../backoffice.slice"
import { WorkspaceModelsSection } from "./WorkspaceModelsSection"

/**
 * The models of the workspace on its backoffice page. Rendered once the project detail is loaded:
 * the mount listener reads the project id from it.
 */
export function ProjectWorkspaceModels() {
  const projectModels = useAppSelector(selectProjectModels)
  const customModels = useAppSelector(selectCustomModels)

  useMount({
    actions: {
      mount: backofficeActions.workspaceModelsMount,
      unmount: backofficeActions.workspaceModelsUnmount,
    },
  })

  return (
    <AsyncRoute data={[projectModels, customModels]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const dispatch = useAppDispatch()
  const project = useValue(selectBackofficeProjectDetail)
  const models = useValue(selectProjectModels)
  const { customModels, types } = useValue(selectCustomModels)
  const projectId = project.id

  return (
    <WorkspaceModelsSection
      models={models}
      customModels={customModels}
      types={types}
      canUpdate
      onToggle={(model, enabled) =>
        void dispatch(backofficeActions.setProjectModel({ projectId, model, enabled }))
      }
      onReset={(model) => void dispatch(backofficeActions.resetProjectModel({ projectId, model }))}
      onCreate={async (input) => {
        const result = await dispatch(backofficeActions.createCustomModel({ projectId, input }))
        return backofficeActions.createCustomModel.fulfilled.match(result)
      }}
      onUpdate={async (customModelId, input) => {
        const result = await dispatch(
          backofficeActions.updateCustomModel({ projectId, customModelId, input }),
        )
        return backofficeActions.updateCustomModel.fulfilled.match(result)
      }}
      onDelete={(customModelId) =>
        void dispatch(backofficeActions.deleteCustomModel({ projectId, customModelId }))
      }
    />
  )
}
