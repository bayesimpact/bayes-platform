import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { BackofficeOrganization, BackofficeUser, TermsDocuments } from "./backoffice.models"
import { backofficeThunks } from "./backoffice.thunks"

interface State {
  organizations: AsyncData<BackofficeOrganization[]>
  users: AsyncData<BackofficeUser[]>
  termsDocuments: AsyncData<TermsDocuments>
}

const initialState: State = {
  organizations: defaultAsyncData,
  users: defaultAsyncData,
  termsDocuments: defaultAsyncData,
}

const slice = createSlice({
  name: "backoffice",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(backofficeThunks.listOrganizations.pending, (state) => {
        if (!ADS.isFulfilled(state.organizations)) {
          state.organizations.status = ADS.Loading
        }
        state.organizations.error = null
      })
      .addCase(backofficeThunks.listOrganizations.fulfilled, (state, action) => {
        state.organizations = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(backofficeThunks.listOrganizations.rejected, (state, action) => {
        state.organizations = {
          status: ADS.Error,
          error: action.error.message || "Failed to fetch organizations",
          value: null,
        }
      })

    builder
      .addCase(backofficeThunks.listUsers.pending, (state) => {
        if (!ADS.isFulfilled(state.users)) {
          state.users.status = ADS.Loading
        }
        state.users.error = null
      })
      .addCase(backofficeThunks.listUsers.fulfilled, (state, action) => {
        state.users = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(backofficeThunks.listUsers.rejected, (state, action) => {
        state.users = {
          status: ADS.Error,
          error: action.error.message || "Failed to fetch users",
          value: null,
        }
      })

    builder.addCase(backofficeThunks.addFeatureFlag.fulfilled, (state, action) => {
      if (!ADS.isFulfilled(state.organizations)) return
      const { projectId, featureFlagKey } = action.payload
      for (const organization of state.organizations.value) {
        const project = organization.projects.find((project) => project.id === projectId)
        if (project && !project.featureFlags.includes(featureFlagKey)) {
          project.featureFlags.push(featureFlagKey)
        }
      }
    })

    builder.addCase(backofficeThunks.removeFeatureFlag.fulfilled, (state, action) => {
      if (!ADS.isFulfilled(state.organizations)) return
      const { projectId, featureFlagKey } = action.payload
      for (const organization of state.organizations.value) {
        const project = organization.projects.find((project) => project.id === projectId)
        if (project) {
          project.featureFlags = project.featureFlags.filter((flag) => flag !== featureFlagKey)
        }
      }
    })

    builder.addCase(backofficeThunks.replaceProjectAgentCategories.fulfilled, (state, action) => {
      if (!ADS.isFulfilled(state.organizations)) return
      const { projectId, categories } = action.payload
      for (const organization of state.organizations.value) {
        const project = organization.projects.find((project) => project.id === projectId)
        if (project) {
          project.agentCategories = categories
        }
      }
    })

    builder
      .addCase(backofficeThunks.listTermsDocuments.pending, (state) => {
        if (!ADS.isFulfilled(state.termsDocuments)) state.termsDocuments.status = ADS.Loading
        state.termsDocuments.error = null
      })
      .addCase(backofficeThunks.listTermsDocuments.fulfilled, (state, action) => {
        state.termsDocuments = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(backofficeThunks.listTermsDocuments.rejected, (state, action) => {
        state.termsDocuments = {
          status: ADS.Error,
          error: action.error.message || "Failed to fetch terms documents",
          value: null,
        }
      })

    builder.addCase(backofficeThunks.updateTermsDocuments.fulfilled, (state, action) => {
      state.termsDocuments = { status: ADS.Fulfilled, error: null, value: action.payload }
    })
  },
})

export type { State as BackofficeState }
export const backofficeInitialState = initialState
export const backofficeActions = { ...slice.actions, ...backofficeThunks }
export const backofficeSlice = slice
