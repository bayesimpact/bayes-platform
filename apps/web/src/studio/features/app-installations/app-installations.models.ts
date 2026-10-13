export type AppInstallation = {
  id: string
  appName: string
  description: string | null
  logoUrl: string | null
  permissions: string[]
  createdAt: number
}
