import type { ActionCreatorWithPayload } from "@reduxjs/toolkit"
import { useEffect } from "react"
import { useParams } from "react-router-dom"
import { useAppDispatch } from "@/common/store/hooks"

type Action = ActionCreatorWithPayload<string | null, string>
type Actions = Record<string, Action | (() => void) | undefined>

export const useSetCurrentIds = (storeActions: Actions) => {
  const dispatch = useAppDispatch()
  const params = useParams()

  useEffect(() => {
    Object.entries(storeActions).forEach(([key, action]) => {
      if (isValidAction(action, key)) {
        return
      }

      const paramKey = formatKey(key)
      const paramValue = params[paramKey] ?? null

      if (action) {
        const result = action(paramValue)
        if (result !== undefined) {
          dispatch(result)
        }
      }
    })
  }, [dispatch, params, storeActions])
}

function isValidAction(action: Action | (() => void) | undefined, key: string) {
  // Skip if action is not a function or key doesn't match pattern "set*Id"
  return !action || typeof action !== "function" || !key.startsWith("set") || !key.endsWith("Id")
}

function formatKey(key: string) {
  // Convert "setFooId" -> "foo" to match param key
  return key.charAt(3).toLowerCase() + key.slice(4)
}
