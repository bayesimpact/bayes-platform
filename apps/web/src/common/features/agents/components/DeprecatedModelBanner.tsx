import type { AgentModel } from "@caseai-connect/api-contracts"
import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  agentModelDeprecationStage,
  buildAgentModelDeprecationInterpolation,
} from "@/common/features/agents/agent-model.helpers"
import { selectAvailableModelsCatalog } from "@/common/features/agents/agents.selectors"
import { useAppSelector } from "@/common/store/hooks"

/**
 * Warns that a model is being retired and names its replacement. Renders nothing when the model
 * is supported, so callers mount it unconditionally — declaring a future deprecation in the
 * provider's model metadata (API) is enough to surface it here.
 *
 * `model` is optional because it lives on the agent settings, whose fetch some views do not gate
 * their rendering on: an absent model renders nothing rather than forcing every caller to branch.
 *
 * Not dismissible: migrating is mandatory, not advisory.
 */
export function DeprecatedModelBanner({ model }: { model?: AgentModel }) {
  const { t } = useTranslation()
  const catalog = useAppSelector(selectAvailableModelsCatalog)
  const interpolation = buildAgentModelDeprecationInterpolation(model, catalog)
  const stage = agentModelDeprecationStage(model, catalog)

  if (!interpolation) return null

  return (
    <Alert variant="destructive" className="bg-orange-50/50 border-orange-200">
      <TriangleAlertIcon />
      <AlertTitle className="font-semibold">
        {t(`agent:model.${stage}.title`, interpolation)}
      </AlertTitle>
      <AlertDescription>
        <span className="text-red-950">{t(`agent:model.${stage}.description`, interpolation)}</span>
      </AlertDescription>
    </Alert>
  )
}
