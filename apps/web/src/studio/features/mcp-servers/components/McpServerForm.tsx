import type { McpServerAuthMethod } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { McpServerHeadersInput } from "./McpServerHeadersInput"
import { buildMcpServerFormSchema, type McpServerFormValues } from "./mcp-server-form.schema"

const AUTH_METHOD_LABEL_KEYS = {
  apiKey: "mcpServers:fields.authMethodApiKey",
  oauth: "mcpServers:fields.authMethodOauth",
  none: "mcpServers:fields.authMethodNone",
} as const satisfies Record<McpServerAuthMethod, string>

const AUTH_METHODS: McpServerAuthMethod[] = ["apiKey", "oauth", "none"]

export type McpServerFormDefaults = {
  name: string
  url: string
  authMethod: McpServerAuthMethod
  /** Headers the server already stores. Empty for a new server. */
  storedHeaderNames: string[]
  /** The server already stores a key, so the field may stay empty. */
  hasStoredApiKey: boolean
  /** The server holds an OAuth authorization, which a new URL would void. */
  hasOauthAuthorization: boolean
}

/** Fields, validation and layout shared by the create and the edit forms. */
export function McpServerForm({
  defaults,
  submitLabel,
  requiresChange,
  onSubmit,
}: {
  defaults: McpServerFormDefaults
  submitLabel: string
  /** Edit form: nothing to save until a field changed. */
  requiresChange: boolean
  onSubmit: (values: McpServerFormValues) => void
}) {
  const { t } = useTranslation()
  const authMethodId = useId()

  const schema = useMemo(
    () =>
      buildMcpServerFormSchema({
        hasStoredApiKey: defaults.hasStoredApiKey,
        apiKeyRequiredMessage: t("mcpServers:fields.apiKeyRequired"),
      }),
    [defaults.hasStoredApiKey, t],
  )

  const form = useForm<McpServerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults.name,
      url: defaults.url,
      authMethod: defaults.authMethod,
      apiKey: "",
      headers: Object.fromEntries(defaults.storedHeaderNames.map((name) => [name, null])),
    },
  })

  const authMethod = form.watch("authMethod")
  const url = form.watch("url")
  const losesOauthAuthorization =
    defaults.hasOauthAuthorization && (authMethod !== "oauth" || url !== defaults.url)
  const keepsStoredApiKey = defaults.hasStoredApiKey && defaults.authMethod === "apiKey"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("mcpServers:fields.name")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("mcpServers:fields.namePlaceholder")} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("mcpServers:fields.url")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder="https://mcp.example.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="authMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("mcpServers:fields.authMethod")}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-col gap-2"
                >
                  {AUTH_METHODS.map((method) => (
                    <div key={method} className="flex items-center gap-2">
                      <RadioGroupItem value={method} id={`${authMethodId}-${method}`} />
                      <Label
                        htmlFor={`${authMethodId}-${method}`}
                        className="cursor-pointer font-normal"
                      >
                        {t(AUTH_METHOD_LABEL_KEYS[method])}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {authMethod === "apiKey" && (
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("mcpServers:fields.apiKey")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="off"
                    placeholder={
                      keepsStoredApiKey
                        ? t("mcpServers:fields.apiKeyStoredPlaceholder")
                        : t("mcpServers:fields.apiKeyPlaceholder")
                    }
                    value={field.value ?? ""}
                  />
                </FormControl>
                {keepsStoredApiKey && (
                  <FormDescription>{t("mcpServers:fields.apiKeyStoredHint")}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {authMethod === "oauth" && !defaults.hasOauthAuthorization && (
          <p className="text-sm text-muted-foreground">{t("mcpServers:fields.oauthHint")}</p>
        )}
        {losesOauthAuthorization && (
          <p className="text-sm text-muted-foreground">
            {t("mcpServers:fields.oauthAuthorizationLost")}
          </p>
        )}
        <FormItem>
          <FormLabel>{t("mcpServers:fields.headers")}</FormLabel>
          <FormDescription>{t("mcpServers:fields.headersHint")}</FormDescription>
          <Controller
            control={form.control}
            name="headers"
            render={({ field }) => (
              <McpServerHeadersInput
                storedHeaderNames={defaults.storedHeaderNames}
                onChange={field.onChange}
              />
            )}
          />
        </FormItem>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || (requiresChange && !form.formState.isDirty)}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
