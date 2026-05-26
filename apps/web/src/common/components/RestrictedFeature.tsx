import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { selectCurrentProjectData } from "../features/projects/projects.selectors"
import { useValue } from "../hooks/use-value"
import { NotFoundRoute } from "../routes/NotFoundRoute"

export function RestrictedFeature({
  feature,
  children,
  returnNull = true,
}: {
  feature: FeatureFlagKey
  children: React.ReactNode
  returnNull?: boolean
}) {
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  if (!hasFeature(feature)) return returnNull ? null : <NotFoundRoute />
  return <>{children}</>
}
