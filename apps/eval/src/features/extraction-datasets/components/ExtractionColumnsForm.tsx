import {
  DATASET_NAME_MIN_LENGTH,
  type ExtractionDatasetColumnRoleDto,
  type ExtractionDatasetFileColumnOutputDto,
  type ExtractionDatasetOutputDto,
  type ExtractionDatasetParamsDto,
  extractionDatasetColumnRoleSchema,
  extractionDatasetSetupInputSchema,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { Fragment, useId, useState } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  COLUMN_ROLE_DESCRIPTIONS,
  COLUMN_ROLE_LABELS,
  COLUMN_ROLES,
} from "@/lib/extraction-columns"
import { useSetUpExtractionDataset } from "../api/mutations"
import { ExtractionColumnRow } from "./ExtractionColumnRow"
import { FilePreviewTable } from "./FilePreviewTable"

/** The role of a column until the person says what it is: left out. */
const DEFAULT_ROLE: ExtractionDatasetColumnRoleDto = "ignore"

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
  const nameId = useId()
  const setUp = useSetUpExtractionDataset(datasetParams)
  const form = useForm({
    resolver: zodResolver(extractionDatasetSetupInputSchema),
    defaultValues: {
      name: dataset.name,
      columns: fileColumns.map((column, index) => ({
        id: column.id,
        index,
        originalName: column.name,
        finalName: column.name,
        // Left out until the person says what the column is.
        role: DEFAULT_ROLE,
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
        name: values.name,
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
  // A header line with no row under it: the API reads its columns, and builds no dataset from it.
  const hasDataRow = fileColumns.some((column) => column.values.length > 0)
  if (!hasDataRow) {
    return (
      <SectionCard title={<Trans>Columns of {fileName}</Trans>}>
        <p className="text-sm text-muted-foreground">
          {fileColumns.length === 0 ? (
            <Trans>This file has no column. Choose another file.</Trans>
          ) : (
            <Trans>This file has no data row. Choose another file.</Trans>
          )}
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
      <SectionCard title={<Trans>Name of the dataset</Trans>}>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={nameId}>
                <Trans comment="The name of a dataset">Name</Trans>
              </FieldLabel>
              <Input
                {...field}
                id={nameId}
                className="max-w-md"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <FieldError>
                  <Plural
                    value={DATASET_NAME_MIN_LENGTH}
                    one="Give the dataset a name of # character or more."
                    other="Give the dataset a name of # characters or more."
                  />
                </FieldError>
              ) : null}
            </Field>
          )}
        />
      </SectionCard>
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
          {/* The select fills its frame: the frame gives it its width. */}
          <div className="w-full sm:w-64">
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
        </div>
        <ul className="flex flex-col divide-y rounded-lg border">
          {fields.map((field, index) => (
            <ExtractionColumnRow
              key={field.id}
              control={form.control}
              index={index}
              originalName={field.originalName}
              isChecked={checked.has(index)}
              onToggle={() => toggle(index)}
            />
          ))}
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
