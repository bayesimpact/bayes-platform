import axios, { type AxiosInstance } from "axios"
import { runtimeConfig } from "@/config/runtime-config"
import { AuthenticationRequiredError, getAccessToken, login } from "./oidcClient"

let axiosInstance: AxiosInstance | null = null

export const getAxiosInstance = (): AxiosInstance => {
  if (!axiosInstance) axiosInstance = buildAxiosInstance()
  return axiosInstance
}

const buildAxiosInstance = (): AxiosInstance => {
  const baseURL = runtimeConfig.apiUrl
  const timeoutMs = Number(runtimeConfig.apiTimeoutMs ?? "10000")
  const axiosInstance = axios.create({ baseURL: `${baseURL}/`, timeout: timeoutMs })

  // Set up request interceptor to automatically inject the OIDC access token
  // This ensures tokens are always fresh and handles refresh automatically
  axiosInstance.interceptors.request.use(
    async (config) => {
      try {
        const token = await getAccessToken()
        config.headers.Authorization = `Bearer ${token}`
      } catch (error) {
        // The session is gone: the user must sign in again
        if (error instanceof AuthenticationRequiredError) {
          console.warn(`${error.message} Signing in again.`)
          // The provider redirect leaves the page: reject the request. The
          // user comes back to the current page once signed in.
          await login()
          return Promise.reject(new Error("Your session has expired. Please log in again."))
        }

        // For other token retrieval errors, let the request proceed without token
        // The API will return 401 and the error can be handled by the caller
        console.error("Failed to get access token for request:", error)
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    },
  )

  // Set up response interceptor to handle 401 errors from the API
  // This catches cases where the token was valid when sent but expired by the time it reached the server
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // If we get a 401 Unauthorized, it might mean the token expired
      // Try to get a fresh token and retry the request once
      if (error.response?.status === 401 && error.config && !error.config._retry) {
        // Mark this request as retried to prevent infinite loops
        error.config._retry = true

        try {
          // Try to get a fresh token
          const token = await getAccessToken()
          // Retry the original request with the new token
          error.config.headers.Authorization = `Bearer ${token}`
          return axiosInstance.request(error.config)
        } catch (tokenError) {
          // The session is gone: sign in again and come back to this page
          if (tokenError instanceof AuthenticationRequiredError) {
            console.warn(`${tokenError.message} Signing in again.`)
            await login()
            return Promise.reject(new Error("Your session has expired. Please log in again."))
          }
          // For other errors, reject with the original error
          return Promise.reject(error)
        }
      }

      // For non-401 errors or already retried requests, reject with the original error
      return Promise.reject(error)
    },
  )

  return axiosInstance
}
