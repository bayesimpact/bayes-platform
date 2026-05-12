import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"

export function RestrictedFeature({
  feature,
  children,
}: {
  feature: FeatureFlagKey
  children: React.ReactNode
}) {
  const { hasFeature } = useFeatureFlags()
  if (!hasFeature(feature)) return null
  return <>{children}</>
}
