import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { ExternalLinkIcon, InfoIcon } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import type { EvaluationExtractionRunAgentSettings } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"
import { StudioRoutes } from "@/studio/routes/helpers"

export function AgentMetadataDialog({
  agentId,
  agentSettings,
  buttonProps = {
    variant: "outline",
    size: "sm",
  },
}: {
  agentId: string
  // Snapshot of the agent-settings revision pinned on the run at creation time.
  agentSettings: EvaluationExtractionRunAgentSettings
  buttonProps?: React.ComponentProps<typeof Button>
}) {
  const { t } = useTranslation()
  const agentsData = useValue(selectAgentsData)
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const { abilities } = useAbility()

  const agent = useMemo(() => {
    return agentsData.find((entry) => entry.id === agentId) ?? null
  }, [agentsData, agentId])

  const studioUrl = StudioRoutes.agent.build({ organizationId, projectId, agentId })
  const canAccessStudio = abilities.canAccessStudio({ projectId })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button {...buttonProps}>
          <InfoIcon className="size-4" />
          {t("evaluationExtractionRun:agentMetadata.viewAgent")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("evaluationExtractionRun:agentMetadata.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!agent && (
            <p className="text-sm text-muted-foreground">
              {t("evaluationExtractionRun:agentMetadata.notFound")}
            </p>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border p-4">
            {agent && (
              <MetadataField label={t("evaluationExtractionRun:agent")} value={agent.name} />
            )}
            <MetadataField
              label={t("evaluationExtractionRun:version.label")}
              value={t("evaluationExtractionRun:version.revision", {
                revision: agentSettings.revision,
              })}
            />
            {/* Naming a revision is optional; both fields are "" when unset. */}
            {agentSettings.revisionName && (
              <MetadataField
                label={t("evaluationExtractionRun:agentMetadata.revisionName")}
                value={agentSettings.revisionName}
              />
            )}
            {agentSettings.revisionDesc && (
              <MetadataField
                label={t("evaluationExtractionRun:agentMetadata.revisionDesc")}
                value={agentSettings.revisionDesc}
              />
            )}
            <MetadataField
              label={t("evaluationExtractionRun:agentMetadata.model")}
              value={agentSettings.model}
              mono
            />
            <MetadataField
              label={t("evaluationExtractionRun:agentMetadata.temperature")}
              value={String(agentSettings.temperature)}
            />
            <MetadataField
              label={t("evaluationExtractionRun:agentMetadata.locale")}
              value={agentSettings.locale}
            />
            <MetadataField
              label={t("evaluationExtractionRun:agentMetadata.documentsRagMode")}
              value={agentSettings.documentsRagMode}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t("evaluationExtractionRun:agentMetadata.prompt")}
            </span>
            <pre className="overflow-auto max-h-48 rounded-lg border bg-muted/50 p-3 text-sm font-mono whitespace-pre-wrap">
              {agentSettings.instructions}
            </pre>
          </div>

          {agentSettings.outputJsonSchema && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t("evaluationExtractionRun:agentMetadata.outputSchema")}
              </span>
              <pre className="overflow-auto max-h-48 rounded-lg border bg-muted/50 p-3 text-sm font-mono whitespace-pre-wrap">
                {JSON.stringify(agentSettings.outputJsonSchema, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {canAccessStudio && (
          <DialogFooter>
            <Button size="sm" asChild>
              <a href={studioUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-4" />
                {t("evaluationExtractionRun:agentMetadata.openInStudio")}
              </a>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetadataField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm${mono ? " font-mono" : ""}`}>{value}</span>
    </>
  )
}
