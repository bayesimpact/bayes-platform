import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"

export function RestrictedFeature({
  feature,
  children,
}: {
  feature: FeatureFlagKey
  children: React.ReactNode
}) {
  const { hasFeature, isLoading } = useFeatureFlags()
  if (isLoading) return null
  if (!hasFeature(feature)) return null
  return <>{children}</>
}
