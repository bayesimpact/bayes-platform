import { isLoopbackRedirectUri, oauthConsentSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Card, CardFooter, CardHeader } from "@caseai-connect/ui/shad/card"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
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
import { type ReactNode, useMemo } from "react"
import { Trans, useTranslation } from "react-i18next"
import { AppPermissionIcon } from "./AppPermissionIcon"
import { BayesCrossMark } from "./BayesCrossMark"

/**
 * The consent form's resolver: an empty project or permission list gets words a person can act on,
 * any other issue keeps the contract's message.
 */
export function useConsentResolver() {
  const { t } = useTranslation("oauthConsent")
  return useMemo(
    () =>
      zodResolver(oauthConsentSchema, {
        error: (issue) => {
          if (issue.code !== "too_small") return undefined
          if (issue.path?.[0] === "projectIds") return t("projectRequired")
          if (issue.path?.[0] === "permissions") return t("permissionRequired")
          return undefined
        },
      }),
    [t],
  )
}

/** The title of each section of the consent screens: projects, workspace, permissions. */
export const SECTION_TITLE = "text-sm font-semibold text-foreground"

/** The small uppercase label of an organization, under a section title. */
export const GROUP_LABEL = "text-[11px] font-medium tracking-wide text-muted-foreground uppercase"

/** The one-line hint under a section label. */
export const SECTION_HINT = "text-xs text-muted-foreground"

/** A workspace or project row, highlighted once picked. */
export function choiceRowClass({ selected, disabled }: { selected: boolean; disabled: boolean }) {
  return cn(
    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-sm",
    selected ? "border-primary bg-accent" : "border-border bg-card hover:border-input",
    disabled && "cursor-not-allowed opacity-60",
  )
}

/** Checked state of the consent screens' checkboxes, until the shared one styles it (bayes-platform#1064). */
export const CONSENT_CHECKBOX =
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"

/**
 * The page, the card, and an optional note under it. The card's children are its sections:
 * `ConsentHeader`, then `CardContent`, then `ConsentFooter` (inside the form when there is one).
 */
export function ConsentPage({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted p-4 font-[Inter,system-ui,sans-serif] text-foreground sm:p-6">
      <div className="flex w-full max-w-[440px] flex-col">
        <Card>{children}</Card>
        {note && (
          <p className="mt-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
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
  trustKey,
  host,
}: {
  logoUrl?: string | null
  headline: string
  description: string | null
  verified: boolean
  /** The trust line's copy, whose `<host>` tag wraps the redirect host. */
  trustKey: string
  host: string
}) {
  return (
    <CardHeader className="block">
      {logoUrl !== undefined && (
        <div className="mb-5 flex items-center gap-3">
          <ClientMark logoUrl={logoUrl} />
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <BayesCrossMark />
        </div>
      )}
      <h1 className="text-lg font-semibold leading-snug">{headline}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <ClientTrust verified={verified} trustKey={trustKey} host={host} />
    </CardHeader>
  )
}

/** One line: a quiet note when the platform vouches for the client, a warning when it does not. */
function ClientTrust({
  verified,
  trustKey,
  host,
}: {
  verified: boolean
  trustKey: string
  host: string
}) {
  // The host is what the person checks, so it stands out from the rest of the line.
  const label = (
    <Trans
      i18nKey={trustKey}
      ns="oauthConsent"
      values={{ host }}
      components={{
        host: <span className={cn("font-semibold", verified && "text-foreground")} />,
      }}
    />
  )
  if (verified) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <BadgeCheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden />
        <span className="min-w-0 break-words">{label}</span>
      </p>
    )
  }
  // The theme has no warning color: the same amber as the design system's warning badge.
  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <TriangleAlertIcon className="size-3.5 shrink-0 text-amber-600" aria-hidden />
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
        className="size-[52px] shrink-0 rounded-xl border bg-card object-contain"
      />
    )
  }
  return (
    <div className="flex size-[52px] shrink-0 items-center justify-center rounded-xl border bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:6px_6px]">
      <GlobeIcon className="size-6 text-muted-foreground" aria-hidden />
    </div>
  )
}

/**
 * The submit button and the way back, kept in view while the page scrolls. It reaches the card's
 * bottom edge, over the card's own bottom padding, so nothing shows under it.
 */
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
    <CardFooter className="sticky bottom-0 -mb-6 flex-col items-stretch rounded-b-xl border-t bg-card pt-4 pb-5">
      <Button
        type="submit"
        className="h-auto min-h-11 w-full whitespace-normal"
        disabled={isSubmitting}
      >
        {isSubmitting ? null : <ShieldCheckIcon className="size-4" aria-hidden />}
        {submitLabel}
      </Button>
      {cancel}
    </CardFooter>
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
      className="mt-3 block w-full shrink-0 text-center text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60"
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
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-card text-muted-foreground",
                          !readOnly &&
                            (canGrant && !disabled
                              ? "cursor-pointer"
                              : "cursor-not-allowed opacity-50"),
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
