import { combineSlices } from "@reduxjs/toolkit"
import { authSlice } from "@/common/features/auth/auth.slice"
import { meSlice } from "@/common/features/me/me.slice"
import { notificationsSlice } from "@/common/features/notifications/notifications.slice"
import { projectsSlice } from "@/common/features/projects/projects.slice"
import { organizationsSlice } from "../features/organizations/organizations.slice"

// Shared slices: always available in both Studio and Desk interfaces.
// Tester / reviewer slices are scoped to their respective interfaces and
// injected lazily via injectTesterSlices / injectReviewerSlices.

export const rootSliceList = [
  authSlice,
  meSlice,
  notificationsSlice,
  organizationsSlice,
  projectsSlice,
]

export const rootSlices = combineSlices(
  ...rootSliceList.map((slice) => ({ [slice.name]: slice.reducer })),
)
