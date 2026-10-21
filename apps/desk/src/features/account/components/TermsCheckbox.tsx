import type { TermsDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { ExternalLinkIcon } from "lucide-react"
import { useId } from "react"
import { Checkbox } from "@/components/ui/checkbox"

export type TermsCheckboxProps = {
  label: string
  /** The document's name, which names its link. */
  documentName: string
  isRequired: boolean
  document: TermsDocumentOutputDto
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** One document of the terms: the box that accepts it, and the link that opens it. */
export function TermsCheckbox({
  label,
  documentName,
  isRequired,
  document,
  checked,
  onCheckedChange,
}: TermsCheckboxProps) {
  const { t } = useLingui()
  const id = useId()
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={id} className="cursor-pointer text-sm leading-snug font-medium">
          {label}{" "}
          <span className="font-normal text-muted-foreground">
            {isRequired ? (
              <Trans comment="A document the person must accept">(required)</Trans>
            ) : (
              <Trans comment="A document the person may accept or not">(optional)</Trans>
            )}
          </span>
        </label>
        {document.url ? (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t`Read the ${documentName} (opens in a new tab)`}
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ExternalLinkIcon aria-hidden className="size-3.5" />
            <Trans>Read it</Trans>
          </a>
        ) : null}
      </div>
    </div>
  )
}
