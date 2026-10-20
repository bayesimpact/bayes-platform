import { isLoopbackRedirectUri, oauthConsentSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { cn } from "@caseai-connect/ui/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  GlobeIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import type { z } from "zod"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
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
  groupConsentProjectsByOrganization,
} from "../oauth-consent.utils"
import { AppPermissionIcon } from "./AppPermissionIcon"
import { BayesCrossMark } from "./BayesCrossMark"

type FormValues = z.infer<typeof oauthConsentSchema>

/** Up to this many workspaces show as rows; more go in a select. */
const MAX_WORKSPACE_ROWS = 5

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
    resolver: zodResolver(oauthConsentSchema),
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

  const header = (
    <>
      <div className="mb-5 flex items-center gap-3">
        <AppMark logoUrl={page.client.logoUrl} />
        <ArrowRightIcon className="size-4 shrink-0 text-[#a1a1aa]" aria-hidden />
        <BayesCrossMark />
      </div>
      <h1 className="text-lg font-semibold leading-snug">
        {t("appHeadline", { name: clientName })}
      </h1>
      {page.client.description && (
        <p className="mt-2 text-sm text-[#71717a]">{page.client.description}</p>
      )}
      <ClientTrust client={page.client} />
    </>
  )

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f4f4f6] p-4 font-[Inter,system-ui,sans-serif] text-[#111118] sm:p-6">
      <div className="flex w-full max-w-[440px] flex-col">
        <div className="rounded-[12px] border border-[#e4e4e7] bg-white p-6 shadow-sm">
          {header}

          {outcome ? (
            <p className="mt-6 text-sm text-[#71717a]">
              {t(outcome === "approved" ? "installed" : "denied", { name: clientName })}
            </p>
          ) : page.projects.length === 0 ? (
            <>
              <p className="mt-6 text-sm text-[#71717a]">{t("noWorkspaces")}</p>
              {/* What the app asks for, so the person can tell an owner what to grant. */}
              <div className="mt-6 flex flex-col gap-3">
                <span className="text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
                  {t("permissions")}
                </span>
                <GroupedPermissions
                  permissions={page.grantablePermissions}
                  selected={[]}
                  available={new Set()}
                  unavailableHint={null}
                  disabled
                  readOnly
                  onToggle={() => undefined}
                />
              </div>
              <CancelLink
                clientName={clientName}
                redirectUri={request.redirect_uri}
                onCancel={deny}
              />
            </>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onValid)} className="mt-6">
                <FormField
                  control={form.control}
                  name="projectIds"
                  render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <FormLabel className="text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
                        {t("workspace")}
                      </FormLabel>
                      <FormDescription className="text-sm text-[#71717a]">
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem className="mt-6 gap-3">
                      <FormLabel className="text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
                        {t("permissions")}
                      </FormLabel>
                      <GroupedPermissions
                        permissions={page.grantablePermissions}
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

                {/* Stays in view while the page scrolls, so the action is never below the fold. */}
                <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 rounded-b-[12px] border-t border-[#e4e4e7] bg-white px-6 pt-4 pb-5">
                  <Button
                    type="submit"
                    className="h-auto min-h-11 w-full rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold whitespace-normal text-white hover:bg-[#6d28d9]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? null : <ShieldCheckIcon className="size-4" aria-hidden />}
                    {isSubmitting ? t("installing") : t("install", { name: clientName })}
                  </Button>
                  <CancelLink
                    clientName={clientName}
                    redirectUri={request.redirect_uri}
                    onCancel={deny}
                    disabled={isSubmitting}
                  />
                </div>
              </form>
            </Form>
          )}
        </div>

        {page.projects.length > 0 && !outcome && (
          <p className="mt-4 rounded-[12px] border border-[#e4e4e7] bg-white px-4 py-3 text-sm text-[#71717a]">
            <Trans
              i18nKey="appRevocability"
              ns="oauthConsent"
              values={{ name: clientName }}
              components={{
                settings: (
                  <Link
                    to={revokePath}
                    className="font-semibold text-[#111118] underline-offset-2 hover:underline"
                  />
                ),
              }}
            />
          </p>
        )}
      </div>
    </div>
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
        <SelectTrigger className="h-10 w-full rounded-lg border-[#e4e4e7] shadow-none">
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

type PermissionGroup = { resource: string; permissions: { permission: string; action: string }[] }

/** `document.read` → resource `document`, action `read`; the order of the list is kept. */
function groupByResource(permissions: string[]): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>()
  for (const permission of permissions) {
    const [resource = permission, ...rest] = permission.split(".")
    const group = groups.get(resource) ?? { resource, permissions: [] }
    group.permissions.push({ permission, action: rest.join("_") })
    groups.set(resource, group)
  }
  return [...groups.values()]
}

function GroupedPermissions({
  permissions,
  selected,
  available,
  unavailableHint,
  disabled,
  readOnly,
  onToggle,
}: {
  permissions: string[]
  selected: string[]
  available: Set<string>
  /** Shown in place of the description when the permission cannot be granted. */
  unavailableHint: string | null
  disabled: boolean
  /** Lists what the app asks for, with nothing to tick. */
  readOnly: boolean
  onToggle: (permission: string, checked: boolean) => void
}) {
  const { t } = useTranslation("oauthConsent")
  return (
    <ul className="flex flex-col gap-4">
      {groupByResource(permissions).map((group) => (
        <li key={group.resource} className="flex items-start gap-3">
          <AppPermissionIcon permission={`${group.resource}.read`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t(`appResource.${group.resource}`, { defaultValue: group.resource })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.permissions.map(({ permission, action }) => {
                const copyKey = permission.replaceAll(".", "_")
                const canGrant = available.has(permission)
                const checked = selected.includes(permission)
                const checkboxId = `oauth-compact-permission-${permission}`
                const name = t(`appPermission.${copyKey}.name`, { defaultValue: permission })
                return (
                  <Tooltip key={permission}>
                    <TooltipTrigger asChild>
                      <label
                        htmlFor={readOnly ? undefined : checkboxId}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                          checked
                            ? "border-[#c4b5fd] bg-[#f5f3ff] text-[#5b21b6]"
                            : "border-[#e4e4e7] bg-white text-[#52525b]",
                          !readOnly &&
                            (canGrant && !disabled
                              ? "cursor-pointer"
                              : "cursor-not-allowed text-[#a1a1aa]"),
                        )}
                      >
                        {readOnly ? null : (
                          <Checkbox
                            id={checkboxId}
                            aria-label={name}
                            className="size-3.5 border-[#d4d4d8] data-[state=checked]:border-[#7c3aed] data-[state=checked]:bg-[#7c3aed] data-[state=checked]:text-white [&_svg]:size-3"
                            checked={checked}
                            disabled={disabled || !canGrant}
                            onCheckedChange={(value) => onToggle(permission, value === true)}
                          />
                        )}
                        {t(`appAction.${action}`, { defaultValue: name })}
                      </label>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      <p className="font-semibold">{name}</p>
                      <p>
                        {canGrant || readOnly
                          ? t(`appPermission.${copyKey}.description`, { defaultValue: "" })
                          : unavailableHint}
                      </p>
                      <code className="mt-1 block font-mono text-[10px] opacity-70">
                        {permission}
                      </code>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </li>
      ))}
    </ul>
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
      className="flex flex-col gap-4"
    >
      {groupConsentProjectsByOrganization(projects).map((group) => (
        <fieldset key={group.organizationId} className="flex flex-col gap-2">
          <legend className="mb-1 text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
            {group.organizationName}
          </legend>
          {group.projects.map((project) => {
            const radioId = `oauth-workspace-${project.id}`
            const selected = value === project.id
            return (
              <label
                key={project.id}
                htmlFor={radioId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
                  selected
                    ? "border-[#7c3aed] bg-[#f5f3ff]"
                    : "border-[#e4e4e7] bg-white hover:border-[#d4d4d8]",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <RadioGroupItem
                  id={radioId}
                  value={project.id}
                  className={cn("border-[#d4d4d8]", selected && "border-[#7c3aed] text-[#7c3aed]")}
                />
                <span className="min-w-0 font-medium break-words">{project.name}</span>
              </label>
            )
          })}
        </fieldset>
      ))}
    </RadioGroup>
  )
}

function CancelLink({
  clientName,
  redirectUri,
  onCancel,
  disabled = false,
}: {
  clientName: string
  redirectUri: string
  onCancel: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation("oauthConsent")
  return (
    <button
      type="button"
      onClick={onCancel}
      disabled={disabled}
      className="mt-3 block w-full shrink-0 text-center text-sm text-[#71717a] underline-offset-2 hover:underline disabled:opacity-60"
    >
      {isLoopbackRedirectUri(redirectUri)
        ? t("cancelTerminal")
        : t("cancelToApp", { name: clientName })}
    </button>
  )
}

/** One line: a quiet note when the platform registered the app, a warning when it did not. */
function ClientTrust({ client }: { client: OAuthConsentClient }) {
  const { t } = useTranslation("oauthConsent")
  if (client.verified) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-[#71717a]">
        <BadgeCheckIcon className="size-3.5 shrink-0 text-[#7c3aed]" aria-hidden />
        <span className="min-w-0 break-words">
          {t("appVerified", { host: client.redirectHost })}
        </span>
      </p>
    )
  }
  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-xs font-medium text-[#92400e]">
      <TriangleAlertIcon className="size-3.5 shrink-0 text-[#d97706]" aria-hidden />
      <span className="min-w-0 break-words">
        {t("appUnverified", { host: client.redirectHost })}
      </span>
    </p>
  )
}

function AppMark({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="size-[52px] shrink-0 rounded-[12px] border border-[#e4e4e7] bg-white object-contain"
      />
    )
  }
  return (
    <div className="flex size-[52px] shrink-0 items-center justify-center rounded-[12px] border border-[#e4e4e7] bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:6px_6px]">
      <GlobeIcon className="size-6 text-[#71717a]" aria-hidden />
    </div>
  )
}
