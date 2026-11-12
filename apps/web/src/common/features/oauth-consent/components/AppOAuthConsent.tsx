import type { oauthConsentSchema } from "@caseai-connect/api-contracts"
import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
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
import { InfoIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import type { z } from "zod"
import type { AppInstaller } from "@/common/features/app-installers/app-installers.models"
import { useInstallerLabel } from "@/common/features/app-installers/components/use-installer-label"
import { useInstallerMailLink } from "@/common/features/app-installers/components/use-installer-mail-link"
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
 * A colleague who can still manage the workspace's apps installed this one: approving is refused,
 * since it would cut their tokens and replace the permissions they granted. They reconnect it
 * themselves. Once they cannot (a former member), whoever approves takes the installation over.
 */
const isInstalledBySomeoneElse = (project: OAuthConsentProject | undefined) =>
  project?.installedBy?.kind === "member"

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
  // The first workspace as displayed (organizations in list order, projects A to Z), skipping
  // those where someone else installed the app.
  const displayedProjects = groupConsentProjectsByOrganization(page.projects).flatMap(
    (group) => group.projects,
  )
  const defaultProjectId = (
    displayedProjects.find((project) => !isInstalledBySomeoneElse(project)) ?? displayedProjects[0]
  )?.id
  const defaultProjectIds = defaultProjectId ? [defaultProjectId] : []
  const defaultAvailable = availablePermissionsFor(page.projects, defaultProjectIds)

  const blockedProjectIds = page.projects
    .filter(isInstalledBySomeoneElse)
    .map((project) => project.id)

  const form = useForm<FormValues>({
    // The button is gone on a blocked workspace. The resolver refuses a submit that comes another way.
    resolver: useConsentResolver(blockedProjectIds),
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
  const isBlocked = isInstalledBySomeoneElse(selectedProject)

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

              {selectedProject?.installedBy && selectedProject.installedBy.kind !== "me" && (
                <AlreadyInstalledAlert
                  clientName={clientName}
                  installer={selectedProject.installedBy}
                  workspaceName={selectedProject.name}
                  revokePath={revokePath}
                />
              )}
              {!isBlocked && (
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
              )}
            </CardContent>

            <ConsentFooter
              // Nothing to install where someone else installed the app: only cancel remains. An
              // exception to ADR 0012 §3.5 (keep the submit button): the alert above says why.
              submitLabel={
                isBlocked
                  ? undefined
                  : isSubmitting
                    ? t("installing")
                    : t(selectedProject?.installedBy ? "reconnect" : "install", {
                        name: clientName,
                      })
              }
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
  const installedHint = useInstalledHint()
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
                {project.installedBy && (
                  <span className="text-xs text-muted-foreground">
                    {installedHint(project.installedBy)}
                  </span>
                )}
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
  const installedHint = useInstalledHint()
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
                hint={project.installedBy ? installedHint(project.installedBy) : undefined}
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

/** The line under a workspace where the app is already installed. */
function useInstalledHint() {
  const { t } = useTranslation("oauthConsent")
  const installerLabel = useInstallerLabel()
  return (installer: AppInstaller) =>
    installer.kind === "me"
      ? t("installedByMe")
      : t("installedBy", { installer: installerLabel(installer) })
}

/**
 * The app is installed on this workspace by someone else. With a colleague: why it cannot be
 * installed again, who to ask, and how to replace the installation on purpose. With a former
 * member, there is nobody to ask: what reconnecting it does, above the permissions to grant.
 */
function AlreadyInstalledAlert({
  clientName,
  installer,
  workspaceName,
  revokePath,
}: {
  clientName: string
  installer: Exclude<AppInstaller, { kind: "me" }>
  workspaceName: string
  revokePath: string
}) {
  const { t } = useTranslation("oauthConsent")
  if (installer.kind === "former-member") {
    return (
      <Alert className="mt-6">
        <InfoIcon />
        <AlertTitle>{t("alreadyInstalled.title", { name: clientName })}</AlertTitle>
        <AlertDescription>{t("alreadyInstalled.byFormerMember")}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert className="mt-6">
      <InfoIcon />
      <AlertTitle>{t("alreadyInstalled.title", { name: clientName })}</AlertTitle>
      <AlertDescription>
        <p>
          <Trans
            i18nKey="alreadyInstalled.byMember"
            ns="oauthConsent"
            values={{ name: clientName }}
            components={{
              installer: (
                <InstallerContact
                  installer={installer}
                  appName={clientName}
                  workspaceName={workspaceName}
                />
              ),
            }}
          />
        </p>
        <p>
          <Trans
            i18nKey="alreadyInstalled.replace"
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
        </p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * The installer's name and email, the email a mail link with the subject filled in, so asking
 * them is one click. The email stays visible for whoever has no mail app to open.
 */
function InstallerContact({
  installer,
  appName,
  workspaceName,
}: {
  installer: Extract<AppInstaller, { kind: "member" }>
  appName: string
  workspaceName: string
}) {
  const mailLink = useInstallerMailLink()
  const email = (
    <a
      href={mailLink(installer, { appName, workspaceName })}
      className="font-semibold text-foreground underline-offset-2 hover:underline"
    >
      {installer.email}
    </a>
  )
  if (!installer.name) return email
  return (
    <>
      {installer.name} ({email})
    </>
  )
}
