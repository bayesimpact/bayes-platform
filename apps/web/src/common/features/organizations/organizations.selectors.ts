import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { OrganizationListItem } from "./organizations.models"

export const selectOrganizationsData = (state: RootState) => state.organizations.data

export const selectOrganizationsList = createSelector(
  selectOrganizationsData,
  (organizationsData): OrganizationListItem[] | null =>
    ADS.isFulfilled(organizationsData) ? organizationsData.value : null,
)

export const selectOrganizationsStatus = (state: RootState) => state.organizations.data.status

export const selectOrganizationsError = (state: RootState) => state.organizations.data.error

export const selectCurrentOrganizationId = (state: RootState) => state.currentIds.organizationId

export const selectCurrentOrganization = createSelector(
  [selectOrganizationsData, selectCurrentOrganizationId],
  (organizationsData, organizationId): AsyncData<OrganizationListItem> => {
    if (!organizationId) {
      // Return loading on purpose
      return { status: ADS.Loading, value: null, error: null }
    }

    if (!ADS.isFulfilled(organizationsData)) return { ...organizationsData }

    const organization = organizationsData.value?.find((o) => o.id === organizationId)

    if (!organization) return { status: ADS.Error, value: null, error: "No organization found" }

    return { status: ADS.Fulfilled, value: organization, error: null }
  },
)

export const hasOrganizationChanged = (prevState: RootState, nextState: RootState): boolean => {
  const prevOrg = selectCurrentOrganization(prevState)
  const nextOrg = selectCurrentOrganization(nextState)
  return prevOrg.value?.id !== nextOrg.value?.id && !!nextOrg.value?.id
}
