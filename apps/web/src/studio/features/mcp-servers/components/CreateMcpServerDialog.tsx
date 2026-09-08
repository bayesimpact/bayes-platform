import { createMcpServerSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"

type FormValues = z.infer<typeof createMcpServerSchema>

export function CreateMcpServerDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: FormValues) => void
}) {
  const { t } = useTranslation()

  const form = useForm<FormValues>({
    resolver: zodResolver(createMcpServerSchema),
    defaultValues: { name: "", url: "", authMethod: "apiKey", apiKey: undefined },
  })

  const authMethod = form.watch("authMethod")

  const handleSubmit = (values: FormValues) => {
    // The API only keeps the key for the apiKey method, but drop it here too so
    // a key typed then switched away from never leaves the browser.
    onSubmit({ ...values, apiKey: values.authMethod === "apiKey" ? values.apiKey : undefined })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mcpServers:create.title")}</DialogTitle>
          <DialogDescription>{t("mcpServers:create.description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      value={field.value ?? "apiKey"}
                      onValueChange={field.onChange}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="apiKey" id="auth-apiKey" />
                        <Label htmlFor="auth-apiKey" className="cursor-pointer font-normal">
                          {t("mcpServers:fields.authMethodApiKey")}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="oauth" id="auth-oauth" />
                        <Label htmlFor="auth-oauth" className="cursor-pointer font-normal">
                          {t("mcpServers:fields.authMethodOauth")}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="none" id="auth-none" />
                        <Label htmlFor="auth-none" className="cursor-pointer font-normal">
                          {t("mcpServers:fields.authMethodNone")}
                        </Label>
                      </div>
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
                        placeholder={t("mcpServers:fields.apiKeyPlaceholder")}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {authMethod === "oauth" && (
              <p className="text-sm text-muted-foreground">{t("mcpServers:fields.oauthHint")}</p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("actions:create")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
