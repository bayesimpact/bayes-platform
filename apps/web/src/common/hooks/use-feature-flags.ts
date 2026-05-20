import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import type { Project } from "../features/projects/projects.models"

function check(flags: FeatureFlagKey[], feature: FeatureFlagKey): boolean {
  return flags.some((flag) => flag === feature)
}

export function useFeatureFlags(project?: Project) {
  const p = useAppSelector(selectCurrentProjectData)
  if (project) {
    return {
      hasFeature: (feature: FeatureFlagKey): boolean => check(project.featureFlags || [], feature),
    }
  } else {
    if (!ADS.isFulfilled(p)) return { hasFeature: () => false }
    return {
      hasFeature: (feature: FeatureFlagKey): boolean => check(p.value.featureFlags || [], feature),
    }
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
