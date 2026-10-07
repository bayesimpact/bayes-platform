import { createSlice } from "@reduxjs/toolkit"
import { generateId } from "@/common/utils/generate-id"
import type { Notification, NotificationContent } from "./notifications.models"

interface State {
  notifications: Notification[]
}

const initialState: State = {
  notifications: [],
}

const slice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    show: (state, action: { payload: NotificationContent }) => {
      state.notifications.push({ id: generateId(), ...action.payload })
    },
    reset: () => initialState,
  },
})

export type { State as NotificationsState }
export const notificationsInitialState = initialState
export const notificationsActions = { ...slice.actions }
export const notificationsSlice = slice
