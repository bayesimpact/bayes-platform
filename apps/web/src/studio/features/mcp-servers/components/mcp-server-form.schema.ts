import { updateMcpServerSchema } from "@bayes-platform/api-contracts"
import type { z } from "zod"

/**
 * One schema for the create and the edit forms: the update contract with the
 * three fields a form always fills made required. The key is required unless
 * the server already stores one, which only the edit form can say.
 */
export function buildMcpServerFormSchema({
  hasStoredApiKey,
  apiKeyRequiredMessage,
}: {
  hasStoredApiKey: boolean
  apiKeyRequiredMessage: string
}) {
  return updateMcpServerSchema
    .required({ name: true, url: true, authMethod: true })
    .superRefine((values, context) => {
      if (values.authMethod === "apiKey" && !hasStoredApiKey && !values.apiKey?.trim()) {
        context.addIssue({ code: "custom", path: ["apiKey"], message: apiKeyRequiredMessage })
      }
    })
}

export type McpServerFormValues = z.infer<ReturnType<typeof buildMcpServerFormSchema>>

/** A header as the form sends it: `null` keeps the value the server already stores. */
export type McpServerFormHeaders = NonNullable<McpServerFormValues["headers"]>
