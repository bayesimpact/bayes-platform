import { isLoopbackRedirectUri, oauthConsentSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
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
import { ScrollFade } from "./ScrollFade"

type FormValues = z.infer<typeof oauthConsentSchema>

/**
 * App install consent. An authorization installs the app on one workspace, so the
 * person picks one. The list shows every workspace they can install on.
 */
export function AppOAuthConsent({ request }: { request: OAuthAuthorizationRequest }) {
  const { t } = useTranslation("oauthConsent")
  const dispatch = useAppDispatch()
  const page = useValue(selectOAuthConsentPage)
  const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null)
  const clientName = page.client.name ?? page.client.redirectHost
  const defaultProjectId = page.projects[0]?.id
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
  const selectedProjectId = selectedProjectIds[0] ?? null
  const available = availablePermissionsFor(page.projects, selectedProjectIds)
  const selectedProject = page.projects.find((project) => project.id === selectedProjectId)

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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f4f4f6] p-4 font-[Inter,system-ui,sans-serif] text-[#111118] sm:p-6">
      <div className="flex w-full max-w-[440px] flex-col">
        <div className="rounded-[12px] border border-[#e4e4e7] bg-white p-6 shadow-sm">
          <div className="mb-5 flex shrink-0 items-center gap-3">
            <AppMark logoUrl={page.client.logoUrl} />
            <ArrowRightIcon className="size-4 shrink-0 text-[#a1a1aa]" aria-hidden />
            <BayesCrossMark />
          </div>
          <h1 className="shrink-0 text-lg font-semibold leading-snug">
            {t("appHeadline", { name: clientName })}
          </h1>
          {page.client.description && (
            <p className="mt-2 shrink-0 text-sm text-[#71717a]">{page.client.description}</p>
          )}
          <ClientTrust client={page.client} />

          {outcome ? (
            <p className="mt-6 text-sm text-[#71717a]">
              {t(outcome === "approved" ? "installed" : "denied", { name: clientName })}
            </p>
          ) : page.projects.length === 0 ? (
            <>
              <div className="mt-6">
                <p className="text-sm text-[#71717a]">{t("noWorkspaces")}</p>
                <div className="mt-6">
                  <PermissionList
                    permissions={page.grantablePermissions}
                    selected={[]}
                    available={new Set()}
                    unavailableHint={null}
                    disabled
                    readOnly
                    onToggle={() => undefined}
                  />
                </div>
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
                <div>
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
                        <WorkspaceChoices
                          projects={page.projects}
                          value={field.value[0] ?? null}
                          disabled={isSubmitting}
                          onChange={(projectId) => setProjectIds([projectId])}
                        />
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
                        <PermissionList
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
                </div>

                <Button
                  type="submit"
                  className="mt-6 h-auto min-h-11 w-full shrink-0 rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold whitespace-normal text-white hover:bg-[#6d28d9]"
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
              </form>
            </Form>
          )}
        </div>

        {page.projects.length > 0 && !outcome && (
          <p className="mt-4 shrink-0 rounded-[12px] border border-[#e4e4e7] bg-white px-4 py-3 text-sm text-[#71717a]">
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
    <ScrollFade className="max-h-64">
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
                    className={cn(
                      "border-[#d4d4d8]",
                      selected && "border-[#7c3aed] text-[#7c3aed]",
                    )}
                  />
                  <span className="min-w-0 font-medium break-words">{project.name}</span>
                </label>
              )
            })}
          </fieldset>
        ))}
      </RadioGroup>
    </ScrollFade>
  )
}

function PermissionList({
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
  readOnly: boolean
  onToggle: (permission: string, checked: boolean) => void
}) {
  const { t } = useTranslation("oauthConsent")
  return (
    <ScrollFade className="max-h-[28rem] pe-1 [scrollbar-gutter:stable]">
      <ul className="flex flex-col gap-3">
        {permissions.map((permission) => {
          const copyKey = permission.replaceAll(".", "_")
          const canGrant = available.has(permission)
          const hint = canGrant ? null : unavailableHint
          const checkboxId = `oauth-permission-${permission}`
          return (
            <li key={permission} className="flex items-start gap-3">
              {readOnly ? null : (
                <Checkbox
                  id={checkboxId}
                  className="mt-1.5 border-[#d4d4d8] data-[state=checked]:border-[#7c3aed] data-[state=checked]:bg-[#7c3aed] data-[state=checked]:text-white"
                  checked={selected.includes(permission)}
                  disabled={disabled || !canGrant}
                  onCheckedChange={(value) => onToggle(permission, value === true)}
                />
              )}
              <AppPermissionIcon permission={permission} />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={readOnly ? undefined : checkboxId}
                  className={cn("block", !readOnly && canGrant && "cursor-pointer")}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      !canGrant && !readOnly && "text-[#a1a1aa]",
                    )}
                  >
                    {t(`appPermission.${copyKey}.name`, { defaultValue: permission })}
                  </p>
                  <p className="text-sm text-[#71717a]">
                    {hint ?? t(`appPermission.${copyKey}.description`, { defaultValue: "" })}
                  </p>
                </label>
                <code className="mt-1 inline-block max-w-full break-all rounded-md bg-[#f4f4f6] px-2 py-0.5 font-mono text-[11px] text-[#71717a]">
                  {permission}
                </code>
              </div>
            </li>
          )
        })}
      </ul>
    </ScrollFade>
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
