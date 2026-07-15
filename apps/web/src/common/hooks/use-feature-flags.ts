import type { FeatureFlagKey, FeatureFlagsDto } from "@caseai-connect/api-contracts"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"

function check(flags: FeatureFlagsDto, feature: FeatureFlagKey): boolean {
  return flags.some((flag) => flag === feature)
}

export function useFeatureFlags(project: { featureFlags: FeatureFlagsDto }) {
  return {
    hasFeature: (feature: FeatureFlagKey): boolean => check(project.featureFlags || [], feature),
  }
}

export type HasFeature = (feature: FeatureFlagKey) => boolean

export function hasFeatureOrThrow({
  state,
  feature,
}: {
  state: RootState
  feature: FeatureFlagKey
}): true {
  const project = selectCurrentProjectData(state)
  if (!ADS.isFulfilled(project)) throw new Error("No project selected")
  const hasFeature = check(project.value.featureFlags, feature)
  if (!hasFeature) throw new Error(`Feature "${feature}" is not enabled for this project`)
  return true
}
