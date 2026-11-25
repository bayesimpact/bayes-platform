import type { UpdateBackofficeCustomModelRequestDto } from "@caseai-connect/api-contracts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import type { CustomModel, CustomModelType } from "../../backoffice.models"
import { CustomModelForm } from "./CustomModelForm"

export function UpdateCustomModelDialog({
  customModel,
  types,
  onUpdate,
  onClose,
}: {
  customModel: CustomModel
  types: CustomModelType[]
  /** Resolves to true once saved, so the dialog closes. */
  onUpdate: (input: UpdateBackofficeCustomModelRequestDto) => Promise<boolean>
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customModel.name}</DialogTitle>
          <DialogDescription>
            {customModel.agentCount > 0
              ? `${customModel.agentCount} agent(s) use it: a new server applies to their next call.`
              : "No agent uses it yet."}
          </DialogDescription>
        </DialogHeader>
        <CustomModelForm
          types={types}
          defaultValues={{
            name: customModel.name,
            baseModel: customModel.baseModel,
            baseUrl: customModel.baseUrl,
            apiKey: undefined,
            servedModelName: customModel.servedModelName,
          }}
          typeLocked
          hasStoredKey={customModel.hasApiKey}
          submitLabel="Save"
          onSubmit={async ({ baseModel: _lockedType, ...input }) => {
            if (await onUpdate(input)) onClose()
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
