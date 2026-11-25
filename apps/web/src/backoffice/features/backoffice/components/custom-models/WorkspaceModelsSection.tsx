import type {
  CreateBackofficeCustomModelRequestDto,
  UpdateBackofficeCustomModelRequestDto,
} from "@caseai-connect/api-contracts"
import type { ReactNode } from "react"
import type { CustomModel, CustomModelType, ProjectModel } from "../../backoffice.models"
import { CustomModelsTable } from "./CustomModelsTable"
import { ProjectModelsTable } from "./ProjectModelsTable"

/**
 * The two lists of models of a workspace, on its backoffice page: the platform models turned
 * on or off, and the models it added on servers of its own.
 */
export function WorkspaceModelsSection({
  models,
  customModels,
  types,
  canUpdate,
  onToggle,
  onReset,
  onCreate,
  onUpdate,
  onDelete,
}: {
  models: ProjectModel[]
  customModels: CustomModel[]
  types: CustomModelType[]
  canUpdate: boolean
  onToggle: (model: string, enabled: boolean) => void
  onReset: (model: string) => void
  onCreate: (input: CreateBackofficeCustomModelRequestDto) => Promise<boolean>
  onUpdate: (id: string, input: UpdateBackofficeCustomModelRequestDto) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  return (
    <div className="grid gap-6">
      <Panel
        title="Added models"
        description="Self-hosted models on servers of this workspace. Each one is one more line in the model list of its agents. Its server receives their conversations."
      >
        <CustomModelsTable
          customModels={customModels}
          types={types}
          canUpdate={canUpdate}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </Panel>
      <Panel
        title="Platform models"
        description="The models this workspace's agents may pick. Agents already on a model turned off keep it."
      >
        <ProjectModelsTable
          models={models}
          canUpdate={canUpdate}
          onToggle={onToggle}
          onReset={onReset}
        />
      </Panel>
    </div>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b space-y-0.5">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
