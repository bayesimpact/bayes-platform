import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { MyProject } from "../projects/projects.models"
import { selectMyProjectsData } from "../projects/projects.selectors"
import type { Organization } from "./organizations.models"

export const selectOrganizationsData = (state: RootState) => state.organizations.data

/** Derived view: an organization with the user's accessible projects grouped under it. */
export type OrganizationWithProjects = Organization & { projects: MyProject[] }

export const selectOrganizationsWithProjectsData = createSelector(
  [selectOrganizationsData, selectMyProjectsData],
  (organizationsData, myProjectsData): AsyncData<OrganizationWithProjects[]> => {
    if (!ADS.isFulfilled(organizationsData)) return { ...organizationsData, value: null }
    if (!ADS.isFulfilled(myProjectsData)) return { ...myProjectsData, value: null }

    const organizationsWithProjects = (organizationsData.value ?? []).map((organization) => ({
      ...organization,
      projects: (myProjectsData.value ?? []).filter(
        (project) => project.organizationId === organization.id,
      ),
    }))

    return { status: ADS.Fulfilled, error: null, value: organizationsWithProjects }
  },
)

export const selectOrganizationsList = createSelector(
  selectOrganizationsData,
  (organizationsData): Organization[] | null =>
    ADS.isFulfilled(organizationsData) ? organizationsData.value : null,
)

export const selectOrganizationsStatus = (state: RootState) => state.organizations.data.status

export const selectOrganizationsError = (state: RootState) => state.organizations.data.error

export const selectCurrentOrganizationId = (state: RootState) => state.currentIds.organizationId

export const selectCurrentOrganization = createSelector(
  [selectOrganizationsData, selectCurrentOrganizationId],
  (organizationsData, organizationId): AsyncData<Organization> => {
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
