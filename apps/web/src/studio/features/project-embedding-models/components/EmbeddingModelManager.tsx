import {
  type EmbeddingModel,
  EmbeddingModelCatalog,
  LOCAL_EMBEDDING_MODELS,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { Settings2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { ProjectEmbeddingModel } from "../project-embedding-models.models"
import {
  selectProjectEmbeddingModels,
  selectProjectEmbeddingModelsData,
} from "../project-embedding-models.selectors"
import { enableProjectEmbeddingModel } from "../project-embedding-models.thunks"

/**
 * Lists the local models of the catalog with their state on the current project and lets a
 * project admin enable one, which launches the re-embedding of the project's documents.
 */
export function EmbeddingModelManager() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const models = useAppSelector(selectProjectEmbeddingModels)
  // Until the list is loaded, "absent" does not mean "not enabled": a job may already run.
  const isLoaded = ADS.isFulfilled(useAppSelector(selectProjectEmbeddingModelsData))
  const modelByName = new Map(models.map((model) => [model.modelName, model] as const))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Settings2Icon className="size-4" />
          {t("projectEmbeddingModels:manage")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-3">
        <div className="space-y-1">
          <p className="font-medium text-sm">{t("projectEmbeddingModels:title")}</p>
          <p className="text-muted-foreground text-xs">{t("projectEmbeddingModels:description")}</p>
        </div>
        <ul className="space-y-3">
          {LOCAL_EMBEDDING_MODELS.map((modelName) => (
            <EmbeddingModelRow
              key={modelName}
              modelName={modelName}
              model={modelByName.get(modelName)}
              isLoaded={isLoaded}
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function EmbeddingModelRow({
  modelName,
  model,
  isLoaded,
}: {
  modelName: EmbeddingModel
  model: ProjectEmbeddingModel | undefined
  isLoaded: boolean
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const metadata = EmbeddingModelCatalog[modelName]
  const status = model?.status
  const isRunning = status === "pending" || status === "processing"
  const progressPercent =
    model && model.totalChunks > 0
      ? Math.min(100, Math.round((model.processedChunks / model.totalChunks) * 100))
      : 0

  return (
    <li className="space-y-1.5 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{metadata.label}</p>
          <p className="text-muted-foreground text-xs">
            {modelName} · {t("projectEmbeddingModels:dimensions", { count: metadata.dimensions })}
          </p>
        </div>
        {isLoaded ? <EmbeddingModelStatusBadge status={status} /> : <Spinner className="size-4" />}
      </div>

      {isRunning && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="flex items-center gap-1 text-muted-foreground text-xs">
            <Spinner className="size-3" />
            {t("projectEmbeddingModels:progress", {
              processed: model?.processedChunks ?? 0,
              total: model?.totalChunks ?? 0,
            })}
          </p>
        </div>
      )}

      {status === "failed" && model && (
        <div className="space-y-1">
          {model.error && (
            <p className="text-destructive text-xs" title={model.error}>
              {model.error}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {t("projectEmbeddingModels:retryResumes", {
              processed: model.processedChunks,
              total: model.totalChunks,
            })}
          </p>
        </div>
      )}

      {status !== "completed" && (
        <Button
          type="button"
          size="sm"
          variant={status === "failed" ? "outline" : "default"}
          disabled={!isLoaded || isRunning}
          onClick={() => dispatch(enableProjectEmbeddingModel({ modelName }))}
        >
          {status === "failed" ? t("actions:retry") : t("actions:enable")}
        </Button>
      )}
    </li>
  )
}

function EmbeddingModelStatusBadge({
  status,
}: {
  status: ProjectEmbeddingModel["status"] | undefined
}) {
  const { t } = useTranslation()
  switch (status) {
    case "completed":
      return <Badge variant="success">{t("projectEmbeddingModels:completed")}</Badge>
    case "processing":
      return <Badge variant="warning">{t("projectEmbeddingModels:processing")}</Badge>
    case "pending":
      return <Badge variant="secondary">{t("status:pending")}</Badge>
    case "failed":
      return <Badge variant="destructive">{t("status:failed")}</Badge>
    default:
      return <Badge variant="outline">{t("projectEmbeddingModels:notEnabled")}</Badge>
  }
}
