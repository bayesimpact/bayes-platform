import { isApplePlatform } from "@caseai-connect/frontend-lib"
import { useLingui } from "@lingui/react/macro"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

export type ShortcutHintProps = {
  /** The key pressed with the system's command key, such as `K`. */
  letter: string
}

/** The keys of a shortcut, beside what it does: ⌘ on an Apple system, Ctrl elsewhere. */
export function ShortcutHint({ letter }: ShortcutHintProps) {
  const { t } = useLingui()
  const modifier = isApplePlatform()
    ? "⌘"
    : t({ message: "Ctrl", comment: "The Control key of a keyboard" })
  return (
    <KbdGroup>
      <Kbd>{modifier}</Kbd>
      <Kbd>{letter}</Kbd>
    </KbdGroup>
  )
}
