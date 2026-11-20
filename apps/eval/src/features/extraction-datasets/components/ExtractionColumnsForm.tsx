import {
  type ExtractionDatasetColumnRoleDto,
  type ExtractionDatasetFileColumnOutputDto,
  type ExtractionDatasetOutputDto,
  type ExtractionDatasetParamsDto,
  extractionDatasetColumnRoleSchema,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { Fragment, useId, useState } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  COLUMN_ROLE_DESCRIPTIONS,
  COLUMN_ROLE_LABELS,
  COLUMN_ROLES,
} from "@/lib/extraction-columns"
import { useSetUpExtractionDataset } from "../api/mutations"
import { FilePreviewTable } from "./FilePreviewTable"

/** What the form holds: each column of the file, the name it takes and its role. */
const columnsFormSchema = z.object({
  columns: z.array(
    z.object({
      id: z.string(),
      index: z.number(),
      originalName: z.string(),
      finalName: z.string(),
      role: extractionDatasetColumnRoleSchema,
    }),
  ),
})

export type ExtractionColumnsFormProps = {
  dataset: ExtractionDatasetOutputDto
  datasetParams: ExtractionDatasetParamsDto
  file: { id: string; fileName: string }
  /** The columns of the file, each with its first values. */
  fileColumns: ExtractionDatasetFileColumnOutputDto[]
  onChooseAnother: () => void
}

/**
 * The second step that builds a dataset: the first rows of the file, then each of its columns
 * with the name it takes and its role. Several columns checked take a role at once.
 */
export function ExtractionColumnsForm({
  dataset,
  datasetParams,
  file,
  fileColumns,
  onChooseAnother,
}: ExtractionColumnsFormProps) {
  const { t, i18n } = useLingui()
  const selectAllId = useId()
  const setUp = useSetUpExtractionDataset(datasetParams)
  const form = useForm({
    resolver: zodResolver(columnsFormSchema),
    defaultValues: {
      columns: fileColumns.map((column, index) => ({
        id: column.id,
        index,
        originalName: column.name,
        finalName: column.name,
        // Left out until the person says what the column is.
        role: "ignore" as ExtractionDatasetColumnRoleDto,
      })),
    },
  })
  const { fields } = useFieldArray({ control: form.control, name: "columns" })
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set())
  const checkedCount = checked.size
  const areAllChecked = fields.length > 0 && checkedCount === fields.length
  const fileName = file.fileName
  const toggle = (index: number) =>
    setChecked((previous) => {
      const next = new Set(previous)
      if (!next.delete(index)) next.add(index)
      return next
    })
  const handleSubmit = form.handleSubmit((values) =>
    setUp.mutate(
      {
        documentId: file.id,
        name: dataset.name,
        columns: values.columns.map((column) => ({
          ...column,
          // A name left empty keeps the file's.
          finalName: column.finalName.trim() || column.originalName,
        })),
      },
      {
        onSuccess: () => toast.success(t`The dataset was built from the file.`),
        onError: () => toast.error(t`The dataset could not be built. Try again.`),
      },
    ),
  )
  if (fileColumns.length === 0) {
    return (
      <SectionCard title={<Trans>Columns of {fileName}</Trans>}>
        <p className="text-sm text-muted-foreground">
          <Trans>This file has no column. Choose another file.</Trans>
        </p>
        <div>
          <Button variant="outline" onClick={onChooseAnother}>
            <Trans>Choose another file</Trans>
          </Button>
        </div>
      </SectionCard>
    )
  }
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
      <SectionCard
        title={<Trans>First rows of {fileName}</Trans>}
        description={<Trans>As the file holds them, to tell what each column is.</Trans>}
      >
        <FilePreviewTable columns={fileColumns} />
      </SectionCard>
      <SectionCard title={<Trans>Role of each column</Trans>}>
        {/* A line per role: its name, then what it means. */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {COLUMN_ROLES.map((role) => (
            <Fragment key={role}>
              <dt className="font-medium">{i18n._(COLUMN_ROLE_LABELS[role])}</dt>
              <dd className="text-muted-foreground">{i18n._(COLUMN_ROLE_DESCRIPTIONS[role])}</dd>
            </Fragment>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={selectAllId}
              checked={areAllChecked}
              indeterminate={checkedCount > 0 && !areAllChecked}
              onCheckedChange={() =>
                setChecked(areAllChecked ? new Set() : new Set(fields.map((_, index) => index)))
              }
            />
            <Label htmlFor={selectAllId} className="font-normal text-muted-foreground">
              {checkedCount === 0 ? (
                <Trans>Select all the columns</Trans>
              ) : (
                <Plural value={checkedCount} one="# column selected" other="# columns selected" />
              )}
            </Label>
          </div>
          <NativeSelect
            aria-label={t`Role of the selected columns`}
            disabled={checkedCount === 0}
            // Back to its first option after each choice: it is an action, not a value.
            value=""
            onChange={(event) => {
              const role = extractionDatasetColumnRoleSchema.safeParse(event.target.value)
              if (!role.success) return
              for (const index of checked) form.setValue(`columns.${index}.role`, role.data)
            }}
          >
            <NativeSelectOption value="">{t`Give the selection a role…`}</NativeSelectOption>
            {COLUMN_ROLES.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {i18n._(COLUMN_ROLE_LABELS[role])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <ul className="flex flex-col divide-y rounded-lg border">
          {fields.map((field, index) => {
            const originalName = field.originalName
            return (
              <li
                key={field.id}
                className="grid grid-cols-[auto_1fr] items-center gap-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <Checkbox
                  checked={checked.has(index)}
                  onCheckedChange={() => toggle(index)}
                  aria-label={t`Select the column ${originalName}`}
                />
                <span className="truncate text-sm font-medium" title={originalName}>
                  {originalName}
                </span>
                <Input
                  {...form.register(`columns.${index}.finalName`)}
                  className="col-span-2 sm:col-span-1"
                  placeholder={originalName}
                  aria-label={t`Name of the column ${originalName} in the dataset`}
                />
                <Controller
                  control={form.control}
                  name={`columns.${index}.role`}
                  render={({ field: roleField }) => (
                    <NativeSelect
                      {...roleField}
                      className="col-span-2 sm:col-span-1"
                      aria-label={t`Role of the column ${originalName}`}
                    >
                      {COLUMN_ROLES.map((role) => (
                        <NativeSelectOption key={role} value={role}>
                          {i18n._(COLUMN_ROLE_LABELS[role])}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                />
              </li>
            )
          })}
        </ul>
        {/* The way back at the far left, away from the button that builds the dataset. */}
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" onClick={onChooseAnother}>
            <Trans>Choose another file</Trans>
          </Button>
          <Button type="submit" disabled={setUp.isPending}>
            <Trans comment="Builds the records of a dataset from the chosen CSV file">
              Build the dataset
            </Trans>
          </Button>
        </div>
      </SectionCard>
    </form>
  )
}
