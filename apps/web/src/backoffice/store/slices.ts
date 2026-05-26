import { createSliceManager } from "../../common/store/dynamic-middleware"
import { backofficeMiddleware } from "../features/backoffice/backoffice.middleware"
import { backofficeSlice } from "../features/backoffice/backoffice.slice"

const backofficeMiddlewareList = [backofficeMiddleware]

export const backofficeSliceList = [backofficeSlice]

export const { injectSlices: injectBackofficeSlices, resetSlices: resetBackofficeSlices } =
  createSliceManager({
    middlewares: backofficeMiddlewareList,
    slices: backofficeSliceList,
  })
