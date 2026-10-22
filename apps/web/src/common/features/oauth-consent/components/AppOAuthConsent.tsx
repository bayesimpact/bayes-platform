import type { oauthConsentSchema } from "@caseai-connect/api-contracts"
import { CardContent } from "@caseai-connect/ui/shad/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { cn } from "@caseai-connect/ui/utils"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import type { z } from "zod"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { OAuthAuthorizationRequest, OAuthConsentProject } from "../oauth-consent.models"
import { selectOAuthConsentPage } from "../oauth-consent.selectors"
import { approveOAuthConsent } from "../oauth-consent.thunks"
import {
  availablePermissionsFor,
  buildOAuthDeniedUrl,
  groupConsentProjectsByOrganization,
} from "../oauth-consent.utils"
import {
  CancelLink,
  ChoiceCard,
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

/** Up to this many workspaces show as rows; more go in a select. */
const MAX_WORKSPACE_ROWS = 5

const APP_COPY = { permission: "appPermission", resource: "appResource" } as const

/**
 * App install consent. An authorization installs the app on one workspace, so the person picks one.
 * The page is the only scroll: workspaces go in a select when there are many, permissions are
 * grouped by resource, and the install button stays in view.
 */
export function AppOAuthConsent({ request }: { request: OAuthAuthorizationRequest }) {
  const { t } = useTranslation("oauthConsent")
  const dispatch = useAppDispatch()
  const page = useValue(selectOAuthConsentPage)
  const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null)
  const clientName = page.client.name ?? page.client.redirectHost
  // The first workspace as displayed: organizations in list order, projects A to Z.
  const defaultProjectId = groupConsentProjectsByOrganization(page.projects)[0]?.projects[0]?.id
  const defaultProjectIds = defaultProjectId ? [defaultProjectId] : []
  const defaultAvailable = availablePermissionsFor(page.projects, defaultProjectIds)

  const form = useForm<FormValues>({
    resolver: useConsentResolver(),
    defaultValues: {
      ...request,
      projectIds: defaultProjectIds,
      permissions: page.grantablePermissions.filter((permission) =>
        defaultAvailable.has(permission),
      ),
    },
  })
  const isSubmitting = form.formState.isSubmitting
  const selectedProjectIds = form.watch("projectIds")
  const available = availablePermissionsFor(page.projects, selectedProjectIds)
  const selectedProject = page.projects.find((project) => project.id === selectedProjectIds[0])

  const setProjectIds = (projectIds: string[]) => {
    form.setValue("projectIds", projectIds, { shouldValidate: form.formState.isSubmitted })
    const nextAvailable = availablePermissionsFor(page.projects, projectIds)
    form.setValue(
      "permissions",
      page.grantablePermissions.filter((permission) => nextAvailable.has(permission)),
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

  const revokePath = selectedProject
    ? StudioRoutes.appInstallations.build({
        organizationId: selectedProject.organizationId,
        projectId: selectedProject.id,
      })
    : StudioRoutes.home.path

  const note =
    page.projects.length > 0 && !outcome ? (
      <Trans
        i18nKey="appRevocability"
        ns="oauthConsent"
        values={{ name: clientName }}
        components={{
          settings: (
            <Link
              to={revokePath}
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            />
          ),
        }}
      />
    ) : null

  return (
    <ConsentPage note={note}>
      <ConsentHeader
        logoUrl={page.client.logoUrl}
        headline={t("appHeadline", { name: clientName })}
        description={page.client.description}
        verified={page.client.verified}
        trustKey={page.client.verified ? "appVerified" : "appUnverified"}
        host={page.client.redirectHost}
      />

      {outcome ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(outcome === "approved" ? "installed" : "denied", { name: clientName })}
          </p>
        </CardContent>
      ) : page.projects.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("noWorkspaces")}</p>
          {/* What the app asks for, so the person can tell an owner what to grant. */}
          <div className="mt-6 flex flex-col gap-3">
            <span className={SECTION_TITLE}>{t("permissions")}</span>
            <GroupedPermissions
              permissions={page.grantablePermissions}
              copy={APP_COPY}
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
                    <FormLabel className={SECTION_TITLE}>{t("workspace")}</FormLabel>
                    <FormDescription className={cn("mt-0.5", SECTION_HINT)}>
                      {t("workspaceHint")}
                    </FormDescription>
                    {page.projects.length > MAX_WORKSPACE_ROWS ? (
                      <WorkspaceSelect
                        projects={page.projects}
                        value={field.value[0] ?? null}
                        disabled={isSubmitting}
                        onChange={(projectId) => setProjectIds([projectId])}
                      />
                    ) : (
                      <WorkspaceChoices
                        projects={page.projects}
                        value={field.value[0] ?? null}
                        disabled={isSubmitting}
                        onChange={(projectId) => setProjectIds([projectId])}
                      />
                    )}
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem className="mt-6 gap-3">
                    <FormLabel className={SECTION_TITLE}>{t("permissions")}</FormLabel>
                    <GroupedPermissions
                      permissions={page.grantablePermissions}
                      copy={APP_COPY}
                      selected={field.value}
                      available={available}
                      unavailableHint={
                        selectedProjectIds.length === 0
                          ? t("selectWorkspaceFirst")
                          : t("appPermissionUnavailable")
                      }
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
            </CardContent>

            <ConsentFooter
              submitLabel={isSubmitting ? t("installing") : t("install", { name: clientName })}
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

function WorkspaceSelect({
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
  const { t } = useTranslation("oauthConsent")
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <FormControl>
        <SelectTrigger className="mt-4 h-10 w-full rounded-lg shadow-none">
          <SelectValue placeholder={t("selectWorkspaceFirst")} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {groupConsentProjectsByOrganization(projects).map((group) => (
          <SelectGroup key={group.organizationId}>
            <SelectLabel>{group.organizationName}</SelectLabel>
            {group.projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

function WorkspaceChoices({
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
      className="mt-4 flex flex-col gap-4"
    >
      {groupConsentProjectsByOrganization(projects).map((group) => (
        <OrganizationGroup key={group.organizationId} name={group.organizationName}>
          {group.projects.map((project) => {
            const radioId = `oauth-workspace-${project.id}`
            return (
              <ChoiceCard
                key={project.id}
                htmlFor={radioId}
                label={project.name}
                disabled={disabled}
                control={<RadioGroupItem id={radioId} value={project.id} />}
              />
            )
          })}
        </OrganizationGroup>
      ))}
    </RadioGroup>
  )
}
