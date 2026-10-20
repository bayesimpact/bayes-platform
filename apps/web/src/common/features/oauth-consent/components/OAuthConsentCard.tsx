import { oauthConsentSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import type { OAuthAuthorizationRequest, OAuthConsentClient } from "../oauth-consent.models"
import { selectOAuthConsentPage } from "../oauth-consent.selectors"
import { approveOAuthConsent } from "../oauth-consent.thunks"
import {
  availablePermissionsFor,
  buildOAuthDeniedUrl,
  groupConsentProjectsByOrganization,
  permissionsFromScope,
} from "../oauth-consent.utils"
import { AppOAuthConsent } from "./AppOAuthConsent"
import { OAuthClientTrustBadge } from "./OAuthClientTrustBadge"

type FormValues = z.infer<typeof oauthConsentSchema>

export function OAuthConsentCard({ request }: { request: OAuthAuthorizationRequest }) {
  const page = useValue(selectOAuthConsentPage)
  if (page.client.kind === "app") return <AppOAuthConsent request={request} />
  return <McpOAuthConsentCard request={request} />
}

/** Consent for an MCP client acting as the person, on the projects they pick. */
function McpOAuthConsentCard({ request }: { request: OAuthAuthorizationRequest }) {
  const { t } = useTranslation("oauthConsent")
  const dispatch = useAppDispatch()
  const page = useValue(selectOAuthConsentPage)
  const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null)
  const clientName = page.client.name ?? page.client.redirectHost

  const defaultProjectIds =
    page.projects.length === 1 && page.projects[0] ? [page.projects[0].id] : []
  const defaultAvailable = availablePermissionsFor(page.projects, defaultProjectIds)
  const form = useForm<FormValues>({
    resolver: zodResolver(oauthConsentSchema),
    defaultValues: {
      ...request,
      projectIds: defaultProjectIds,
      permissions: permissionsFromScope(request.scope).filter((permission) =>
        defaultAvailable.has(permission),
      ),
    },
  })
  const isSubmitting = form.formState.isSubmitting
  const selectedProjectIds = form.watch("projectIds")
  const available = availablePermissionsFor(page.projects, selectedProjectIds)

  const setProjectIds = (projectIds: string[]) => {
    form.setValue("projectIds", projectIds, { shouldValidate: form.formState.isSubmitted })
    // A permission no selected project allows cannot stay selected.
    const nextAvailable = availablePermissionsFor(page.projects, projectIds)
    form.setValue(
      "permissions",
      form.getValues("permissions").filter((permission) => nextAvailable.has(permission)),
    )
  }

  const onValid = async (values: FormValues) => {
    const result = await dispatch(approveOAuthConsent(values))
    if (approveOAuthConsent.fulfilled.match(result)) {
      setOutcome("approved")
      window.location.assign(result.payload.redirectTo)
    }
  }

  const deny = () => {
    setOutcome("denied")
    window.location.assign(
      buildOAuthDeniedUrl({ redirectUri: request.redirect_uri, state: request.state }),
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">{t("headline", { name: clientName })}</CardTitle>
          {page.client.description && <CardDescription>{page.client.description}</CardDescription>}
          <CardDescription>{t("redirectHost", { host: page.client.redirectHost })}</CardDescription>
          <ClientTrust client={page.client} />
        </CardHeader>

        {outcome ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">{t(outcome, { name: clientName })}</p>
          </CardContent>
        ) : page.projects.length === 0 ? (
          <>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="button" variant="outline" onClick={deny}>
                {t("actions:decline")}
              </Button>
            </CardFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onValid)} className="flex flex-col gap-6">
              <CardContent className="flex flex-col gap-6">
                <FormField
                  control={form.control}
                  name="projectIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("projects")}</FormLabel>
                      <FormDescription>{t("projectsHint")}</FormDescription>
                      <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
                        {groupConsentProjectsByOrganization(page.projects).map((group) => (
                          <fieldset key={group.organizationId} className="flex flex-col gap-2">
                            <legend className="mb-1 text-xs font-medium text-muted-foreground">
                              {group.organizationName}
                            </legend>
                            {group.projects.map((project) => {
                              const checkboxId = `oauth-project-${project.id}`
                              return (
                                <div key={project.id} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    id={checkboxId}
                                    checked={field.value.includes(project.id)}
                                    disabled={isSubmitting}
                                    onCheckedChange={(checked) =>
                                      setProjectIds(
                                        checked === true
                                          ? [...field.value, project.id]
                                          : field.value.filter(
                                              (projectId) => projectId !== project.id,
                                            ),
                                      )
                                    }
                                  />
                                  <label htmlFor={checkboxId} className="min-w-0 cursor-pointer">
                                    {project.name}
                                  </label>
                                </div>
                              )
                            })}
                          </fieldset>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("permissions")}</FormLabel>
                      <div className="flex flex-col gap-3">
                        {page.grantablePermissions.map((permission) => (
                          <PermissionCheckbox
                            key={permission}
                            permission={permission}
                            checked={field.value.includes(permission)}
                            unavailableHint={
                              available.has(permission)
                                ? null
                                : t(
                                    selectedProjectIds.length === 0
                                      ? "selectProjectFirst"
                                      : "permissionUnavailable",
                                  )
                            }
                            disabled={isSubmitting}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked
                                  ? [...field.value, permission]
                                  : field.value.filter(
                                      (selectedPermission) => selectedPermission !== permission,
                                    ),
                              )
                            }
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>

              <CardFooter className="justify-end gap-2">
                <Button type="button" variant="outline" onClick={deny} disabled={isSubmitting}>
                  {t("actions:decline")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {t(isSubmitting ? "approving" : "approve")}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
    </div>
  )
}

function ClientTrust({ client }: { client: OAuthConsentClient }) {
  const { t } = useTranslation("oauthConsent")
  if (client.verified) {
    return (
      <div className="flex items-center gap-2 pt-2">
        <OAuthClientTrustBadge verified />
        <span className="text-xs text-muted-foreground">{t("verifiedHint")}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1 pt-2">
      <OAuthClientTrustBadge verified={false} />
      <span className="text-xs text-muted-foreground">
        {t("unverifiedHint", { host: client.redirectHost })}
      </span>
    </div>
  )
}

function PermissionCheckbox({
  permission,
  checked,
  unavailableHint,
  disabled,
  onCheckedChange,
}: {
  permission: string
  checked: boolean
  /** Why the permission cannot be picked, null when it can. */
  unavailableHint: string | null
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { t } = useTranslation("oauthConsent")
  const checkboxId = `oauth-permission-${permission}`
  const copyKey = permission.replaceAll(".", "_")
  return (
    <div className="flex items-start gap-2 text-sm">
      <Checkbox
        id={checkboxId}
        className="mt-0.5"
        checked={checked}
        disabled={disabled || unavailableHint !== null}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <label
        htmlFor={checkboxId}
        className={
          unavailableHint === null ? "min-w-0 cursor-pointer" : "min-w-0 text-muted-foreground"
        }
      >
        <span className="font-medium">
          {t(`permission.${copyKey}.name`, { defaultValue: permission })}
        </span>
        <span className="block text-muted-foreground">
          {unavailableHint ?? t(`permission.${copyKey}.description`, { defaultValue: "" })}
        </span>
      </label>
    </div>
  )
}
