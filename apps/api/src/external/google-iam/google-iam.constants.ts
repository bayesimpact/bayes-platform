/**
 * Value of the `*_AUTH` env vars (e.g. `PDF_CONVERTER_AUTH`) that turns on
 * Google IAM authentication: requests must then carry a Google ID token minted
 * for the target service URL. Terraform sets it in production, where internal
 * Cloud Run services are locked behind invoker IAM; locally those services run
 * open and no header is sent.
 */
export const GOOGLE_IAM_AUTH_MODE = "google-iam"

export function isGoogleIamAuthEnabled(value: string | undefined): boolean {
  return value === GOOGLE_IAM_AUTH_MODE
}
