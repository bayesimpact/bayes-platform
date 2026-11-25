import type {
  ConversationDatasetParamsDto,
  ConversationDatasetRecordOutputDto,
} from "@bayes-platform/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { EllipsisIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useCreateConversationDatasetRecord,
  useCreateConversationDatasetRecords,
  useDeleteConversationDatasetRecord,
  useUpdateConversationDatasetRecord,
} from "../api/mutations"
import { conversationDatasetRecordsQueryOptions } from "../api/queries"
import { BulkRecordsDialog } from "./BulkRecordsDialog"
import { conversationRecordColumnsOf } from "./conversation-record-columns"
import { RecordDialog } from "./RecordDialog"

/** What a person does to the records through a dialog. */
type RecordAction =
  | { kind: "add" }
  | { kind: "bulk" }
  | { kind: "edit"; record: ConversationDatasetRecordOutputDto }
  | { kind: "delete"; record: ConversationDatasetRecordOutputDto }

export type ConversationRecordsSectionProps = {
  dataset: ConversationDatasetParamsDto
  /** Whether the person adds, changes and deletes records. */
  canEdit: boolean
}

/** All the records of a dataset, however many, with the ways to add, change and delete them. */
export function ConversationRecordsSection({ dataset, canEdit }: ConversationRecordsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const { data: records } = useSuspenseQuery(conversationDatasetRecordsQueryOptions(dataset))
  const [action, setAction] = useState<RecordAction | null>(null)
  const close = () => setAction(null)
  const createRecord = useCreateConversationDatasetRecord(dataset)
  const createRecords = useCreateConversationDatasetRecords(dataset)
  const updateRecord = useUpdateConversationDatasetRecord(dataset)
  const deleteRecord = useDeleteConversationDatasetRecord(dataset)
  const table = useReactTable({
    data: records,
    columns: conversationRecordColumnsOf({
      translate: (descriptor) => i18n._(descriptor),
      renderActions: canEdit
        ? (record) => (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t`More actions on the record`}
                  />
                }
              >
                <EllipsisIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAction({ kind: "edit", record })}>
                  <PencilIcon aria-hidden />
                  <Trans comment="Changes a record of a dataset">Edit</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setAction({ kind: "delete", record })}
                >
                  <Trash2Icon aria-hidden />
                  <Trans comment="Deletes a record of a dataset">Delete</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        : null,
    }),
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
  })
  const total = records.length
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            <Trans comment="The title of the records of a dataset">Records</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            <Plural value={total} _0="No record yet" one="# record" other="# records" />
          </p>
        </div>
        {canEdit ? (
          <ButtonGroup>
            <Button variant="outline" onClick={() => setAction({ kind: "add" })}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              <Trans>Add a record</Trans>
            </Button>
            <Button variant="outline" onClick={() => setAction({ kind: "bulk" })}>
              <Trans comment="Opens the dialog that adds several records to a dataset at once">
                Bulk add
              </Trans>
            </Button>
          </ButtonGroup>
        ) : null}
      </div>
      <DataTable table={table} empty={<Trans>This dataset has no record yet.</Trans>} />
      {action?.kind === "add" ? (
        <RecordDialog
          title={<Trans>Add a record</Trans>}
          submitLabel={<Trans>Add the record</Trans>}
          defaultValues={{ input: "", expectedOutput: "" }}
          isPending={createRecord.isPending}
          onClose={close}
          onSubmit={(record) =>
            createRecord.mutate(record, {
              onSuccess: () => {
                toast.success(t`The record was added.`)
                close()
              },
              onError: () => toast.error(t`The record could not be added. Try again.`),
            })
          }
        />
      ) : null}
      {action?.kind === "edit" ? (
        <RecordDialog
          title={<Trans>Edit the record</Trans>}
          submitLabel={<Trans>Save</Trans>}
          defaultValues={{
            input: action.record.input,
            expectedOutput: action.record.expectedOutput,
          }}
          isPending={updateRecord.isPending}
          onClose={close}
          onSubmit={(record) =>
            updateRecord.mutate(
              { recordId: action.record.id, ...record },
              {
                onSuccess: () => {
                  toast.success(t`The record was saved.`)
                  close()
                },
                onError: () => toast.error(t`The record could not be saved. Try again.`),
              },
            )
          }
        />
      ) : null}
      {action?.kind === "bulk" ? (
        <BulkRecordsDialog
          isPending={createRecords.isPending}
          onClose={close}
          onSubmit={(records) =>
            createRecords.mutate(records, {
              onSuccess: () => {
                toast.success(t`The records were added.`)
                close()
              },
              onError: () => toast.error(t`The records could not be added. Try again.`),
            })
          }
        />
      ) : null}
      <ConfirmDialog
        isOpen={action?.kind === "delete"}
        onOpenChange={(isOpen) => {
          if (!isOpen) close()
        }}
        title={<Trans>Delete this record?</Trans>}
        description={<Trans>The record leaves the dataset for good.</Trans>}
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteRecord.isPending}
        onConfirm={() => {
          if (action?.kind !== "delete") return
          deleteRecord.mutate(action.record.id, {
            onSuccess: () => {
              toast.success(t`The record was deleted.`)
              close()
            },
            onError: () => toast.error(t`The record could not be deleted. Try again.`),
          })
        }}
      />
    </section>
  )
}
