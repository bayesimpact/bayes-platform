import { EVALUATION_EXTRACTION_DATASET_SCHEMA_COLUMN_ROLES } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter } from "@caseai-connect/ui/shad/dialog"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { Fragment, useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import z from "zod"
import { Loader } from "@/common/components/Loader"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { FileList } from "@/eval/features/evaluation-extraction-datasets/components/FileList"
import { FilePreview } from "@/eval/features/evaluation-extraction-datasets/components/FilePreview"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetFile,
  EvaluationExtractionDatasetFileColumn,
  EvaluationExtractionDatasetSchemaColumnRole,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import {
  selectCurrentFileData,
  selectFileColumnsData,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.selectors"
import { evaluationExtractionDatasetsActions } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.slice"
import { currentIdsActions } from "@/eval/store/currentIds.slice"

export function EvaluationExtractionDatasetInitializer({
  dataset,
}: {
  dataset: EvaluationExtractionDataset
}) {
  const dispatch = useAppDispatch()
  const file = useAppSelector(selectCurrentFileData)

  useEffect(() => {
    return () => {
      dispatch(currentIdsActions.setFileId(null))
    }
  }, [dispatch])

  const hasFile = ADS.isFulfilled(file)
  return <div>{hasFile ? <ColumnsEditor file={file.value} dataset={dataset} /> : <FileList />}</div>
}

function ColumnsEditor({
  file,
  dataset,
}: {
  file: EvaluationExtractionDatasetFile
  dataset: EvaluationExtractionDataset
}) {
  const dispatch = useAppDispatch()
  const columnsData = useAppSelector(selectFileColumnsData)
  useEffect(() => {
    dispatch(evaluationExtractionDatasetsActions.getFileColumns({ documentId: file.id }))
  }, [file, dispatch])

  return (
    <div>
      {ADS.isFulfilled(columnsData) && file ? (
        <FormEdition file={file} dataset={dataset} originalColumns={columnsData.value} />
      ) : (
        <div className="my-12">
          <Loader />
        </div>
      )}
    </div>
  )
}

function FormEdition({
  file,
  dataset,
  originalColumns,
}: {
  file: EvaluationExtractionDatasetFile
  dataset: EvaluationExtractionDataset
  originalColumns: EvaluationExtractionDatasetFileColumn[]
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const schema = z.object({
    name: z.string().min(3, t("evaluation:validation.minNameLength")),
    columns: z.array(
      z.object({
        id: z.string(),
        originalName: z.string(),
        finalName: z.string(),
        role: z.enum(EVALUATION_EXTRACTION_DATASET_SCHEMA_COLUMN_ROLES),
        index: z.number(),
      }),
    ),
  })

  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors, isValid },
    reset: resetForm,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: dataset.name,
      columns: originalColumns.map((column, index) => ({
        id: column.id,
        originalName: column.name,
        finalName: column.name,
        role: "ignore" as const,
        index,
      })),
    },
  })

  const { fields, update } = useFieldArray({ control, name: "columns" })

  const handleFormSubmit = (data: FormData) => {
    dispatch(
      evaluationExtractionDatasetsActions.updateOne({
        datasetId: dataset.id,
        documentId: file.id,
        name: data.name,
        columns: data.columns,
      }),
    )

    resetForm()
  }

  return (
    <form className="px-6" onSubmit={handleSubmit(handleFormSubmit)}>
      <FieldGroup className="py-4">
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dataset-name">{t("evaluation:dataset.props.name")}</FieldLabel>
              <Input
                id="dataset-name"
                placeholder={t("evaluation:dataset.props.placeholders.name")}
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </Field>
          </FieldGroup>
        </FieldSet>

        {originalColumns.length > 0 ? (
          <>
            <FieldSet className="min-w-0">
              <details open>
                <summary className="cursor-pointer text-sm font-medium select-none">
                  {t("evaluation:dataset.columns.preview")}
                </summary>
                <div className="mt-2">
                  <FilePreview columns={originalColumns} />
                </div>
              </details>
            </FieldSet>

            <FieldSet>
              <FieldLabel>{t("evaluation:dataset.columns.roles.title")}</FieldLabel>
              <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-4 gap-y-2 border rounded-md p-4">
                {fields.map((field, fieldIndex) => (
                  <Fragment key={field.id}>
                    <span className="truncate text-sm text-muted-foreground">{fieldIndex + 1}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {field.originalName}
                    </span>
                    <Input
                      className="h-8 text-sm"
                      placeholder={field.originalName}
                      {...register(`columns.${fieldIndex}.finalName`)}
                    />
                    <Select
                      value={field.role}
                      onValueChange={(value) => {
                        const current = getValues(`columns.${fieldIndex}`)
                        update(fieldIndex, {
                          ...current,
                          role: value as EvaluationExtractionDatasetSchemaColumnRole,
                        })
                      }}
                    >
                      <SelectTrigger size="sm" className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVALUATION_EXTRACTION_DATASET_SCHEMA_COLUMN_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(`evaluation:dataset.columns.roles.${role}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Fragment>
                ))}
              </div>
            </FieldSet>
          </>
        ) : (
          <p>{t("evaluation:dataset.columns.noColumns")}</p>
        )}
      </FieldGroup>

      <DialogFooter>
        <Button type="submit" disabled={!isValid}>
          {t("actions:submit")}
        </Button>
      </DialogFooter>
    </form>
  )
}
