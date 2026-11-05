export type AppInstallation = {
  id: string
  appName: string
  description: string | null
  logoUrl: string | null
  /** Where the app is used. */
  appUrl: string | null
  permissions: string[]
  createdAt: number
}
