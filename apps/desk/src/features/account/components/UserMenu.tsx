import type { MeUserOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"
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
  locale: string
  locales: readonly string[]
  onLocaleChange: (locale: string) => void
  onSignOut: () => void
}

/** Each language in its own name, from the browser, capitalized as a menu item: "English", "Français". */
function languageName(locale: string): string {
  const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale
  return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}`
}

export function UserMenu({ user, locale, locales, onLocaleChange, onSignOut }: UserMenuProps) {
  const { t } = useLingui()
  const email = user.email
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" aria-label={t`Open the menu of ${email}`} />}
      >
        <span className="max-w-48 truncate">{user.name ?? user.email}</span>
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm text-foreground">
              {user.name ?? user.email}
            </span>
            {user.name ? <span className="block truncate">{user.email}</span> : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Trans>Language</Trans>
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={onLocaleChange}>
            {locales.map((code) => (
              <DropdownMenuRadioItem key={code} value={code} lang={code}>
                {languageName(code)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon aria-hidden />
          <Trans>Sign out</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
