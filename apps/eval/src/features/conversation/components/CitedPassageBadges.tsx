import { useLingui } from "@lingui/react/macro"
import type { CitedPassages } from "../hooks/use-cited-passages"
import { AnnotationBadge } from "./AnnotationBadge"

export type CitedPassageBadgesProps = {
  citedPassages: CitedPassages
  /** The element the messages render in, where the bubbles are drawn. */
  layer: HTMLElement
}

/**
 * The numbers of the passages the messages quoted, kept on their reply once sent: each bubble
 * jumps to the chip of the message that sent it.
 */
export function CitedPassageBadges({ citedPassages, layer }: CitedPassageBadgesProps) {
  const { t } = useLingui()
  return citedPassages.numbered.map(({ key, range, number }) => (
    <AnnotationBadge
      key={key}
      range={range}
      layer={layer}
      number={number}
      label={t`Show annotation ${number} in its message`}
      onOpen={() => citedPassages.showChip(key)}
    />
  ))
}
