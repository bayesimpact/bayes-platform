import { Logger } from "@nestjs/common"
import { GoogleAuth } from "google-auth-library"

export const gcpCredentialsCheck = async (): Promise<boolean> => {
  let check: boolean = false
  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    })
    const client = await auth.getClient()
    const token = await client.getAccessToken()
    check = !!token
  } catch (err) {
    Logger.error(`GCP auth check failed: ${JSON.stringify(err)}`, undefined, "GcpTools")
  }
  return check
}
