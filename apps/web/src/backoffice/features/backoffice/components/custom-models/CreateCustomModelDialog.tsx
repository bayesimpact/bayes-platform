import type { CreateBackofficeCustomModelRequestDto } from "@caseai-connect/api-contracts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import type { CustomModelType } from "../../backoffice.models"
import { CustomModelForm } from "./CustomModelForm"

export function CreateCustomModelDialog({
  types,
  onCreate,
  onClose,
}: {
  types: CustomModelType[]
  /** Resolves to true once saved, so the dialog closes. */
  onCreate: (input: CreateBackofficeCustomModelRequestDto) => Promise<boolean>
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a model</DialogTitle>
          <DialogDescription>
            It appears next to the platform models in the model list of this workspace's agents. Its
            server receives their conversations.
          </DialogDescription>
        </DialogHeader>
        <CustomModelForm
          types={types}
          defaultValues={{
            name: "",
            baseModel: types[0]?.model ?? "",
            baseUrl: "",
            apiKey: undefined,
            servedModelName: null,
          }}
          typeLocked={false}
          hasStoredKey={false}
          submitLabel="Add"
          onSubmit={async (values) => {
            if (await onCreate(values)) onClose()
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
