import type { MeUserOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { ChevronDownIcon, CircleHelpIcon, LogOutIcon, PencilIcon } from "lucide-react"
import { isLocale, type Locale } from "@/app/i18n"
import { ExternalLink } from "@/components/shared/ExternalLink"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type UserMenuProps = {
  user: MeUserOutputDto
  locale: Locale
  locales: readonly Locale[]
  /** The install's help center, opened in a new tab; `null` when the install has none. */
  helpCenterUrl: string | null
  onLocaleChange: (locale: Locale) => void
  onEditName: () => void
  onSignOut: () => void
}

/** Each language in its own name, from the browser, capitalized as a menu item: "English", "Français". */
function languageName(locale: Locale): string {
  const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale
  return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}`
}

export function UserMenu({
  user,
  locale,
  locales,
  helpCenterUrl,
  onLocaleChange,
  onEditName,
  onSignOut,
}: UserMenuProps) {
  const { t } = useLingui()
  const { name, email } = user
  // The name starts with the visible text, which voice control users say.
  const menuLabel = t({
    message: `${name}, menu of ${email}`,
    comment: "The button of the person's menu, which shows their name",
  })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" aria-label={menuLabel} />}>
        <span className="max-w-48 truncate">{name}</span>
        <ChevronDownIcon data-icon="inline-end" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm text-foreground">{name}</span>
            <span className="block truncate">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onEditName}>
            <PencilIcon aria-hidden />
            <Trans>Edit your name</Trans>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Trans>Language</Trans>
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(value) => {
              if (isLocale(value)) onLocaleChange(value)
            }}
          >
            {locales.map((code) => (
              <DropdownMenuRadioItem key={code} value={code} lang={code}>
                {languageName(code)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {helpCenterUrl ? (
          <DropdownMenuItem render={<ExternalLink href={helpCenterUrl} hasIcon={false} />}>
            <CircleHelpIcon aria-hidden />
            <Trans>Help center</Trans>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon aria-hidden />
          <Trans>Sign out</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
