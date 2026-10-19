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
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import type {
  OAuthAuthorizationRequest,
  OAuthConsentClient,
  OAuthConsentProject,
} from "../oauth-consent.models"
import { selectOAuthConsentPage } from "../oauth-consent.selectors"
import { approveOAuthConsent } from "../oauth-consent.thunks"
import {
  availablePermissionsFor,
  buildOAuthDeniedUrl,
  permissionsFromScope,
} from "../oauth-consent.utils"
import { OAuthClientTrustBadge } from "./OAuthClientTrustBadge"

type FormValues = z.infer<typeof oauthConsentSchema>

type OrganizationGroup = {
  organizationId: string
  organizationName: string
  projects: OAuthConsentProject[]
}

export function OAuthConsentCard({ request }: { request: OAuthAuthorizationRequest }) {
  const { t } = useTranslation("oauthConsent")
  const dispatch = useAppDispatch()
  const page = useValue(selectOAuthConsentPage)
  const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null)
  const clientName = page.client.name ?? page.client.redirectHost
  // An app is installed on one workspace and asks for what its manifest offers.
  const isApp = page.client.kind === "app"

  const defaultProjectIds =
    page.projects.length === 1 && page.projects[0] ? [page.projects[0].id] : []
  const defaultAvailable = availablePermissionsFor(page.projects, defaultProjectIds)
  const form = useForm<FormValues>({
    resolver: zodResolver(oauthConsentSchema),
    defaultValues: {
      ...request,
      projectIds: defaultProjectIds,
      permissions: isApp
        ? page.grantablePermissions.filter((permission) => defaultAvailable.has(permission))
        : permissionsFromScope(request.scope).filter((permission) =>
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
      isApp
        ? page.grantablePermissions.filter((permission) => nextAvailable.has(permission))
        : form.getValues("permissions").filter((permission) => nextAvailable.has(permission)),
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
          <CardTitle className="text-lg">
            {t(isApp ? "appHeadline" : "headline", { name: clientName })}
          </CardTitle>
          {page.client.description && <CardDescription>{page.client.description}</CardDescription>}
          <CardDescription>{t("redirectHost", { host: page.client.redirectHost })}</CardDescription>
          <ClientTrust client={page.client} />
        </CardHeader>

        {outcome ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t(isApp && outcome === "approved" ? "installed" : outcome, { name: clientName })}
            </p>
          </CardContent>
        ) : page.projects.length === 0 ? (
          <>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t(isApp ? "noWorkspaces" : "noProjects")}
              </p>
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
                  render={({ field }) =>
                    isApp ? (
                      <FormItem>
                        <FormLabel>{t("workspace")}</FormLabel>
                        <FormDescription>{t("workspaceHint")}</FormDescription>
                        <WorkspaceRadioGroup
                          projects={page.projects}
                          value={field.value[0] ?? null}
                          disabled={isSubmitting}
                          onChange={(projectId) => setProjectIds([projectId])}
                        />
                        <FormMessage />
                      </FormItem>
                    ) : (
                      <FormItem>
                        <FormLabel>{t("projects")}</FormLabel>
                        <FormDescription>{t("projectsHint")}</FormDescription>
                        <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
                          {groupByOrganization(page.projects).map((group) => (
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
                    )
                  }
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
                            copyNamespace={
                              isApp ? "oauthConsent:appPermission" : "oauthConsent:permission"
                            }
                            checked={field.value.includes(permission)}
                            unavailableHint={
                              available.has(permission)
                                ? null
                                : t(
                                    selectedProjectIds.length === 0
                                      ? isApp
                                        ? "selectWorkspaceFirst"
                                        : "selectProjectFirst"
                                      : isApp
                                        ? "appPermissionUnavailable"
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
                  {isApp
                    ? t(isSubmitting ? "installing" : "install")
                    : t(isSubmitting ? "approving" : "approve")}
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
        <span className="text-xs text-muted-foreground">
          {t(client.kind === "app" ? "appVerifiedHint" : "verifiedHint")}
        </span>
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

/** One workspace per install: the organization comes first, as in the project picker. */
function WorkspaceRadioGroup({
  projects,
  value,
  disabled,
  onChange,
}: {
  projects: OAuthConsentProject[]
  value: string | null
  disabled: boolean
  onChange: (projectId: string) => void
}) {
  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={onChange}
      disabled={disabled}
      className="flex max-h-60 flex-col gap-3 overflow-y-auto"
    >
      {groupByOrganization(projects).map((group) => (
        <fieldset key={group.organizationId} className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            {group.organizationName}
          </legend>
          {group.projects.map((project) => {
            const radioId = `oauth-workspace-${project.id}`
            return (
              <div key={project.id} className="flex items-center gap-2 text-sm">
                <RadioGroupItem id={radioId} value={project.id} />
                <label htmlFor={radioId} className="min-w-0 cursor-pointer">
                  {project.name}
                </label>
              </div>
            )
          })}
        </fieldset>
      ))}
    </RadioGroup>
  )
}

function PermissionCheckbox({
  permission,
  copyNamespace,
  checked,
  unavailableHint,
  disabled,
  onCheckedChange,
}: {
  permission: string
  /** Where the permission's name and description are: an app's permissions are worded for a workspace. */
  copyNamespace: "oauthConsent:permission" | "oauthConsent:appPermission"
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
          {t(`${copyNamespace}.${copyKey}.name`, { defaultValue: permission })}
        </span>
        <span className="block text-muted-foreground">
          {unavailableHint ?? t(`${copyNamespace}.${copyKey}.description`, { defaultValue: "" })}
        </span>
      </label>
    </div>
  )
}

function groupByOrganization(projects: OAuthConsentProject[]): OrganizationGroup[] {
  const groups = new Map<string, OrganizationGroup>()
  for (const project of projects) {
    const group = groups.get(project.organizationId) ?? {
      organizationId: project.organizationId,
      organizationName: project.organizationName,
      projects: [],
    }
    group.projects.push(project)
    groups.set(project.organizationId, group)
  }
  return [...groups.values()]
}
