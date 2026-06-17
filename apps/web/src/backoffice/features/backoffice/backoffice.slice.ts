import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  BackofficeProjectDetail,
  BackofficeUserDetail,
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeProjects,
  PaginatedBackofficeUsers,
  TermsDocuments,
} from "./backoffice.models"
import { backofficeThunks } from "./backoffice.thunks"

interface ListQuery {
  page: number
  limit: number
  search: string
}

interface State {
  organizations: AsyncData<PaginatedBackofficeOrganizations>
  organizationsQuery: ListQuery
  projects: AsyncData<PaginatedBackofficeProjects>
  projectsQuery: ListQuery
  projectDetail: AsyncData<BackofficeProjectDetail>
  users: AsyncData<PaginatedBackofficeUsers>
  usersQuery: ListQuery
  userDetail: AsyncData<BackofficeUserDetail>
  termsDocuments: AsyncData<TermsDocuments>
}

const defaultListQuery: ListQuery = { page: 0, limit: 10, search: "" }

const initialState: State = {
  organizations: defaultAsyncData,
  organizationsQuery: defaultListQuery,
  projects: defaultAsyncData,
  projectsQuery: defaultListQuery,
  projectDetail: defaultAsyncData,
  users: defaultAsyncData,
  usersQuery: defaultListQuery,
  userDetail: defaultAsyncData,
  termsDocuments: defaultAsyncData,
}

const slice = createSlice({
  name: "backoffice",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
    resetProjectDetail: (state) => {
      state.projectDetail = defaultAsyncData
    },
    resetUserDetail: (state) => {
      state.userDetail = defaultAsyncData
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(backofficeThunks.listOrganizations.pending, (state, action) => {
        if (!ADS.isFulfilled(state.organizations)) {
          state.organizations.status = ADS.Loading
        }
        state.organizations.error = null
        state.organizationsQuery = {
          page: action.meta.arg?.page ?? state.organizationsQuery.page,
          limit: action.meta.arg?.limit ?? state.organizationsQuery.limit,
          search: action.meta.arg?.search ?? state.organizationsQuery.search,
        }
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
      .addCase(backofficeThunks.listProjects.pending, (state, action) => {
        if (!ADS.isFulfilled(state.projects)) {
          state.projects.status = ADS.Loading
        }
        state.projects.error = null
        state.projectsQuery = {
          page: action.meta.arg?.page ?? state.projectsQuery.page,
          limit: action.meta.arg?.limit ?? state.projectsQuery.limit,
          search: action.meta.arg?.search ?? state.projectsQuery.search,
        }
      })
      .addCase(backofficeThunks.listProjects.fulfilled, (state, action) => {
        state.projects = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(backofficeThunks.listProjects.rejected, (state, action) => {
        state.projects = {
          status: ADS.Error,
          error: action.error.message || "Failed to fetch projects",
          value: null,
        }
      })

    builder
      .addCase(backofficeThunks.getProject.pending, (state) => {
        state.projectDetail.status = ADS.Loading
        state.projectDetail.error = null
      })
      .addCase(backofficeThunks.getProject.fulfilled, (state, action) => {
        state.projectDetail = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(backofficeThunks.getProject.rejected, (state, action) => {
        state.projectDetail = {
          status: ADS.Error,
          error: action.error.message || "Failed to fetch project",
          value: null,
        }
      })

    builder
      .addCase(backofficeThunks.listUsers.pending, (state, action) => {
        if (!ADS.isFulfilled(state.users)) {
          state.users.status = ADS.Loading
        }
        state.users.error = null
        state.usersQuery = {
          page: action.meta.arg?.page ?? state.usersQuery.page,
          limit: action.meta.arg?.limit ?? state.usersQuery.limit,
          search: action.meta.arg?.search ?? state.usersQuery.search,
        }
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

    builder
      .addCase(backofficeThunks.getUser.pending, (state) => {
        state.userDetail.status = ADS.Loading
        state.userDetail.error = null
      })
      .addCase(backofficeThunks.getUser.fulfilled, (state, action) => {
        state.userDetail = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(backofficeThunks.getUser.rejected, (state, action) => {
        state.userDetail = {
          status: ADS.Error,
          error: action.error.message || "Failed to fetch user",
          value: null,
        }
      })

    builder.addCase(backofficeThunks.addFeatureFlag.fulfilled, (state, action) => {
      if (!ADS.isFulfilled(state.organizations)) return
      const { projectId, featureFlagKey } = action.payload
      for (const organization of state.organizations.value.organizations) {
        const project = organization.projects.find((project) => project.id === projectId)
        if (project && !project.featureFlags.includes(featureFlagKey)) {
          project.featureFlags.push(featureFlagKey)
        }
      }
    })

    builder.addCase(backofficeThunks.removeFeatureFlag.fulfilled, (state, action) => {
      if (!ADS.isFulfilled(state.organizations)) return
      const { projectId, featureFlagKey } = action.payload
      for (const organization of state.organizations.value.organizations) {
        const project = organization.projects.find((project) => project.id === projectId)
        if (project) {
          project.featureFlags = project.featureFlags.filter((flag) => flag !== featureFlagKey)
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
