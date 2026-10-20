import { isLoopbackRedirectUri } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { cn } from "@caseai-connect/ui/utils"
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  GlobeIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AppPermissionIcon } from "./AppPermissionIcon"
import { BayesCrossMark } from "./BayesCrossMark"

/** The title of each section of the consent screens: projects, workspace, permissions. */
export const SECTION_TITLE = "text-sm font-semibold text-[#111118]"

/** The small uppercase label of an organization, under a section title. */
export const GROUP_LABEL = "text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase"

/** The one-line hint under a section label. */
export const SECTION_HINT = "text-xs text-[#71717a]"

/** A workspace or project row, highlighted once picked. */
export function choiceRowClass({ selected, disabled }: { selected: boolean; disabled: boolean }) {
  return cn(
    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-sm",
    selected ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-[#e4e4e7] bg-white hover:border-[#d4d4d8]",
    disabled && "cursor-not-allowed opacity-60",
  )
}

/** Violet checkbox of the consent screens: the shared one shows no fill once checked. */
export const CONSENT_CHECKBOX =
  "border-[#d4d4d8] data-[state=checked]:border-[#7c3aed] data-[state=checked]:bg-[#7c3aed] data-[state=checked]:text-white"

/** The page, the card, and an optional note under it. */
export function ConsentPage({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f4f4f6] p-4 font-[Inter,system-ui,sans-serif] text-[#111118] sm:p-6">
      <div className="flex w-full max-w-[440px] flex-col">
        <div className="rounded-[12px] border border-[#e4e4e7] bg-white p-6 shadow-sm">
          {children}
        </div>
        {note && (
          <p className="mt-4 rounded-[12px] border border-[#e4e4e7] bg-white px-4 py-3 text-sm text-[#71717a]">
            {note}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The headline, the description and the trust line, under the client's mark pointing to Bayes
 * when the client has one to show (`logoUrl` undefined leaves the marks out).
 */
export function ConsentHeader({
  logoUrl,
  headline,
  description,
  verified,
  trustLabel,
}: {
  logoUrl?: string | null
  headline: string
  description: string | null
  verified: boolean
  trustLabel: string
}) {
  return (
    <>
      {logoUrl !== undefined && (
        <div className="mb-5 flex items-center gap-3">
          <ClientMark logoUrl={logoUrl} />
          <ArrowRightIcon className="size-4 shrink-0 text-[#a1a1aa]" aria-hidden />
          <BayesCrossMark />
        </div>
      )}
      <h1 className="text-lg font-semibold leading-snug">{headline}</h1>
      {description && <p className="mt-2 text-sm text-[#71717a]">{description}</p>}
      <ClientTrust verified={verified} label={trustLabel} />
    </>
  )
}

/** One line: a quiet note when the platform vouches for the client, a warning when it does not. */
function ClientTrust({ verified, label }: { verified: boolean; label: string }) {
  if (verified) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-[#71717a]">
        <BadgeCheckIcon className="size-3.5 shrink-0 text-[#7c3aed]" aria-hidden />
        <span className="min-w-0 break-words">{label}</span>
      </p>
    )
  }
  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-xs font-medium text-[#92400e]">
      <TriangleAlertIcon className="size-3.5 shrink-0 text-[#d97706]" aria-hidden />
      <span className="min-w-0 break-words">{label}</span>
    </p>
  )
}

function ClientMark({ logoUrl }: { logoUrl: string | null }) {
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

/** The submit button and the way back, kept in view while the page scrolls. */
export function ConsentFooter({
  submitLabel,
  isSubmitting,
  cancel,
}: {
  submitLabel: string
  isSubmitting: boolean
  cancel: ReactNode
}) {
  return (
    <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 rounded-b-[12px] border-t border-[#e4e4e7] bg-white px-6 pt-4 pb-5">
      <Button
        type="submit"
        className="h-auto min-h-11 w-full rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold whitespace-normal text-white hover:bg-[#6d28d9]"
        disabled={isSubmitting}
      >
        {isSubmitting ? null : <ShieldCheckIcon className="size-4" aria-hidden />}
        {submitLabel}
      </Button>
      {cancel}
    </div>
  )
}

export function CancelLink({
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

/**
 * Permissions grouped by resource, one small checkbox per action, the details on hover. An app
 * and an MCP client word them differently, hence the two copy namespaces.
 */
export function GroupedPermissions({
  permissions,
  copy,
  selected,
  available,
  unavailableHint,
  disabled,
  readOnly,
  onToggle,
}: {
  permissions: string[]
  copy: { permission: "appPermission" | "permission"; resource: "appResource" | "resource" }
  selected: string[]
  available: Set<string>
  /** Shown in place of the description when the permission cannot be granted. */
  unavailableHint: string | null
  disabled: boolean
  /** Lists what the client asks for, with nothing to tick. */
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
              {t(`${copy.resource}.${group.resource}`, { defaultValue: group.resource })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.permissions.map(({ permission, action }) => {
                const copyKey = permission.replaceAll(".", "_")
                const canGrant = available.has(permission)
                const checked = selected.includes(permission)
                const checkboxId = `oauth-permission-${permission}`
                const name = t(`${copy.permission}.${copyKey}.name`, { defaultValue: permission })
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
                            className={cn("size-3.5 [&_svg]:size-3", CONSENT_CHECKBOX)}
                            checked={checked}
                            disabled={disabled || !canGrant}
                            onCheckedChange={(value) => onToggle(permission, value === true)}
                          />
                        )}
                        {t(`permissionAction.${action}`, { defaultValue: name })}
                      </label>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      <p className="font-semibold">{name}</p>
                      <p>
                        {canGrant || readOnly
                          ? t(`${copy.permission}.${copyKey}.description`, { defaultValue: "" })
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
