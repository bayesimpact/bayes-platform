import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
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
  const { hasFeature } = useFeatureFlags()
  if (!hasFeature(feature)) return returnNull ? null : <NotFoundRoute redirectToHome />
  return <>{children}</>
}
