import type { oauthConsentSchema } from "@caseai-connect/api-contracts"
import { CardContent } from "@caseai-connect/ui/shad/card"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { cn } from "@caseai-connect/ui/utils"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import type { OAuthAuthorizationRequest, OAuthConsentProject } from "../oauth-consent.models"
import { selectOAuthConsentPage } from "../oauth-consent.selectors"
import { approveOAuthConsent } from "../oauth-consent.thunks"
import {
  availablePermissionsFor,
  buildOAuthDeniedUrl,
  groupConsentProjectsByOrganization,
  permissionsFromScope,
} from "../oauth-consent.utils"
import {
  CancelLink,
  ChoiceCard,
  CONSENT_CHECKBOX,
  ConsentFooter,
  ConsentHeader,
  ConsentPage,
  GroupedPermissions,
  OrganizationGroup,
  SECTION_HINT,
  SECTION_TITLE,
  useConsentResolver,
} from "./ConsentLayout"

type FormValues = z.infer<typeof oauthConsentSchema>

const MCP_COPY = { permission: "permission", resource: "resource" } as const

/** Consent for an MCP client acting as the person, on the projects they pick. */
export function McpOAuthConsent({ request }: { request: OAuthAuthorizationRequest }) {
  const { t } = useTranslation("oauthConsent")
  const dispatch = useAppDispatch()
  const page = useValue(selectOAuthConsentPage)
  const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null)
  const clientName = page.client.name ?? page.client.redirectHost

  const defaultProjectIds =
    page.projects.length === 1 && page.projects[0] ? [page.projects[0].id] : []
  const defaultAvailable = availablePermissionsFor(page.projects, defaultProjectIds)
  const form = useForm<FormValues>({
    resolver: useConsentResolver(),
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
    <ConsentPage>
      {/* No marks: an MCP client has no logo to show, only a generic placeholder. */}
      <ConsentHeader
        headline={t("headline", { name: clientName })}
        description={page.client.description}
        verified={page.client.verified}
        trustKey={page.client.verified ? "mcpVerified" : "mcpUnverified"}
        host={page.client.redirectHost}
      />

      {outcome ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{t(outcome, { name: clientName })}</p>
        </CardContent>
      ) : page.projects.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
          <div className="mt-6 flex flex-col gap-3">
            <span className={SECTION_TITLE}>{t("permissions")}</span>
            <GroupedPermissions
              permissions={page.grantablePermissions}
              copy={MCP_COPY}
              selected={[]}
              available={new Set()}
              unavailableHint={null}
              disabled
              readOnly
              onToggle={() => undefined}
            />
          </div>
          <CancelLink clientName={clientName} redirectUri={request.redirect_uri} onCancel={deny} />
        </CardContent>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onValid)} className="flex flex-col gap-6">
            <CardContent>
              <FormField
                control={form.control}
                name="projectIds"
                render={({ field }) => (
                  <FormItem className="gap-0">
                    <FormLabel className={SECTION_TITLE}>{t("projects")}</FormLabel>
                    <FormDescription className={cn("mt-0.5", SECTION_HINT)}>
                      {t("projectsHint")}
                    </FormDescription>
                    <ProjectChoices
                      projects={page.projects}
                      value={field.value}
                      disabled={isSubmitting}
                      onChange={setProjectIds}
                    />
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              {/* Hidden until a project is picked: what can be granted depends on the projects. */}
              {selectedProjectIds.length > 0 && (
                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem className="mt-6 gap-3">
                      <FormLabel className={SECTION_TITLE}>{t("permissions")}</FormLabel>
                      <GroupedPermissions
                        permissions={page.grantablePermissions}
                        copy={MCP_COPY}
                        selected={field.value}
                        available={available}
                        unavailableHint={t("permissionUnavailable")}
                        disabled={isSubmitting}
                        readOnly={false}
                        onToggle={(permission, checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, permission]
                              : field.value.filter(
                                  (selectedPermission) => selectedPermission !== permission,
                                ),
                          )
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>

            <ConsentFooter
              submitLabel={t(isSubmitting ? "approving" : "approve")}
              isSubmitting={isSubmitting}
              cancel={
                <CancelLink
                  clientName={clientName}
                  redirectUri={request.redirect_uri}
                  onCancel={deny}
                  disabled={isSubmitting}
                />
              }
            />
          </form>
        </Form>
      )}
    </ConsentPage>
  )
}

/** Several projects per authorization, so a checkbox per row. */
function ProjectChoices({
  projects,
  value,
  disabled,
  onChange,
}: {
  projects: OAuthConsentProject[]
  value: string[]
  disabled: boolean
  onChange: (projectIds: string[]) => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      {groupConsentProjectsByOrganization(projects).map((group) => (
        <OrganizationGroup key={group.organizationId} name={group.organizationName}>
          {group.projects.map((project) => {
            const checkboxId = `oauth-project-${project.id}`
            const selected = value.includes(project.id)
            return (
              <ChoiceCard
                key={project.id}
                htmlFor={checkboxId}
                label={project.name}
                disabled={disabled}
                control={
                  <Checkbox
                    id={checkboxId}
                    className={CONSENT_CHECKBOX}
                    checked={selected}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      onChange(
                        checked === true
                          ? [...value, project.id]
                          : value.filter((projectId) => projectId !== project.id),
                      )
                    }
                  />
                }
              />
            )
          })}
        </OrganizationGroup>
      ))}
    </div>
  )
}
