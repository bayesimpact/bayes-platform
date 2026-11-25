import type {
  CreateBackofficeCustomModelRequestDto,
  UpdateBackofficeCustomModelRequestDto,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import type { CustomModel, CustomModelType } from "../../backoffice.models"
import { CreateCustomModelDialog } from "./CreateCustomModelDialog"
import { UpdateCustomModelDialog } from "./UpdateCustomModelDialog"

type DialogState = { kind: "closed" } | { kind: "create" } | { kind: "edit"; model: CustomModel }

/**
 * The models a workspace added next to the platform models: each is a self-hosted type on its
 * own server, offered as one more line in the model list of the workspace's agents.
 */
export function CustomModelsTable({
  customModels,
  types,
  canUpdate,
  onCreate,
  onUpdate,
  onDelete,
}: {
  customModels: CustomModel[]
  types: CustomModelType[]
  canUpdate: boolean
  onCreate: (input: CreateBackofficeCustomModelRequestDto) => Promise<boolean>
  onUpdate: (id: string, input: UpdateBackofficeCustomModelRequestDto) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a reload.
  "use no memo"
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })
  const [modelToDelete, setModelToDelete] = useState<CustomModel | null>(null)

  const columns = useMemo<ColumnDef<CustomModel>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => "Model",
        cell: ({ row }) => (
          <div className="flex min-w-48 flex-col gap-1">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.baseModel}</span>
          </div>
        ),
      },
      {
        id: "server",
        header: () => "Server",
        meta: { className: "w-full" } satisfies DataTableColumnMeta,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 whitespace-normal">
            <span className="text-sm break-all">{row.original.baseUrl}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.hasApiKey ? "Own key" : "No key"}
              {row.original.servedModelName ? ` · served as ${row.original.servedModelName}` : ""}
            </span>
          </div>
        ),
      },
      {
        id: "agents",
        header: () => "Used by",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {row.original.agentCount === 0
              ? "No agent"
              : `${row.original.agentCount} agent${row.original.agentCount > 1 ? "s" : ""}`}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) =>
          canUpdate && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDialog({ kind: "edit", model: row.original })}
              >
                <PencilIcon className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={row.original.agentCount > 0}
                title={
                  row.original.agentCount > 0
                    ? "Agents use this model: switch them to another model first."
                    : undefined
                }
                onClick={() => setModelToDelete(row.original)}
              >
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            </div>
          ),
      },
    ],
    [canUpdate],
  )

  const table = useReactTable({ data: customModels, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="space-y-3">
      {canUpdate && (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setDialog({ kind: "create" })}>
            <PlusIcon className="size-4" />
            Add a model
          </Button>
        </div>
      )}
      <DataTable
        table={table}
        empty={
          <p className="text-center text-muted-foreground">
            No model added: the agents only see the platform models.
          </p>
        }
      />
      {dialog.kind === "create" && (
        <CreateCustomModelDialog
          types={types}
          onCreate={onCreate}
          onClose={() => setDialog({ kind: "closed" })}
        />
      )}
      {dialog.kind === "edit" && (
        <UpdateCustomModelDialog
          customModel={dialog.model}
          types={types}
          onUpdate={(input) => onUpdate(dialog.model.id, input)}
          onClose={() => setDialog({ kind: "closed" })}
        />
      )}
      <ConfirmDialog
        open={modelToDelete !== null}
        title={`Delete "${modelToDelete?.name ?? ""}"?`}
        description="It leaves the model list of the agents. Its server and key are forgotten."
        confirmLabel="Delete"
        onConfirm={() => {
          if (modelToDelete) onDelete(modelToDelete.id)
          setModelToDelete(null)
        }}
        onCancel={() => setModelToDelete(null)}
      />
    </div>
  )
}
