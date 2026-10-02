import { SIGN_IN_ERRORS } from "@caseai-connect/api-contracts"

export type SignInErrorKey = "emailNotVerified" | "emailRequired" | "emailLinkingDisabled"

const SIGN_IN_ERROR_KEYS: Record<string, SignInErrorKey> = {
  [SIGN_IN_ERRORS.EMAIL_NOT_VERIFIED]: "emailNotVerified",
  [SIGN_IN_ERRORS.EMAIL_REQUIRED]: "emailRequired",
  [SIGN_IN_ERRORS.EMAIL_LINKING_DISABLED]: "emailLinkingDisabled",
}

/** The translation key of a sign-in refusal the API explains, if `description` is one. */
export function signInErrorKey(description: string | null | undefined): SignInErrorKey | undefined {
  return description ? SIGN_IN_ERROR_KEYS[description] : undefined
}
