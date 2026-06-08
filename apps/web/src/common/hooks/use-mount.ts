import type { ActionCreatorWithoutPayload } from "@reduxjs/toolkit"
import { useEffect } from "react"
import { useAppDispatch } from "../store/hooks"

export function useMount({
  actions: { mount, unmount },
  condition,
  refreshOn,
}: {
  actions: {
    mount: ActionCreatorWithoutPayload
    unmount: ActionCreatorWithoutPayload
  }
  condition?: boolean // Optional condition to control mounting; if false, mount/unmount actions won't be dispatched
  refreshOn?: (string | null)[] // Optional array of dependencies to refresh the effect when they change
}) {
  const dispatch = useAppDispatch()
  useEffect(() => {
    if (condition === false) return
    dispatch(mount())
    return () => {
      dispatch(unmount())
    }
  }, [condition, dispatch, mount, unmount, ...(refreshOn || [])])
}
