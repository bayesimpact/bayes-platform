import type { TermsDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { useId } from "react"
import { ExternalLink } from "@/components/shared/ExternalLink"
import { Checkbox } from "@/components/ui/checkbox"

export type TermsCheckboxProps = {
  label: string
  /** The document's name, which names its link. */
  documentName: string
  isRequired: boolean
  /** A required document left unchecked when the person sent the form. */
  isInvalid: boolean
  document: TermsDocumentOutputDto
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** One document of the terms: the box that accepts it, and the link that opens it. */
export function TermsCheckbox({
  label,
  documentName,
  isRequired,
  isInvalid,
  document,
  checked,
  onCheckedChange,
}: TermsCheckboxProps) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        id={id}
        checked={checked}
        aria-invalid={isInvalid}
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
          <ExternalLink
            href={document.url}
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {/* The name starts with the visible text, which voice control users say. */}
            <Trans comment="The link to a document of the terms, named after it for screen readers">
              Read it<span className="sr-only">: the {documentName}</span>
            </Trans>
          </ExternalLink>
        ) : null}
      </div>
    </div>
  )
}
