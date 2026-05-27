import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { CampaignReport } from "./reports.models"
import { getCampaignReport } from "./reports.thunks"

interface State {
  report: AsyncData<CampaignReport>
}

const initialState: State = {
  report: defaultAsyncData,
}

const slice = createSlice({
  name: "reviewCampaignsReports",
  initialState,
  reducers: {
    reset: () => initialState,
    mount: () => {},
    unmount: () => {},
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCampaignReport.pending, (state) => {
        state.report = {
          status: ADS.Loading,
          error: null,
          value: null,
        }
      })
      .addCase(getCampaignReport.fulfilled, (state, action) => {
        state.report = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(getCampaignReport.rejected, (state, action) => {
        state.report = {
          status: ADS.Error,
          error: action.error.message || "Failed to load report",
          value: null,
        }
      })
  },
})

export const reviewCampaignsReportsActions = { ...slice.actions }
export const reviewCampaignsReportsSlice = slice
