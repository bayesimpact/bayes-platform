import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Input } from "@caseai-connect/ui/shad/input"
import { TriangleAlertIcon, XIcon } from "lucide-react"
import { type KeyboardEvent, useState } from "react"
import { z } from "zod"

/** The addresses of a typed or pasted text ("a@x.org, b@x.org"), lowercased. */
function splitEmails(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean)
}

const isEmail = (candidate: string) => z.email().safeParse(candidate).success

/**
 * The emails to invite, as removable chips. An email of someone already in the workspace is
 * flagged: the dialog sends them nothing, their roles change from their member page.
 */
export function InviteEmailsField({
  emails,
  onChange,
  existingMemberEmails,
  onOpenMember,
  onDraftChange,
}: {
  emails: string[]
  onChange: (emails: string[]) => void
  existingMemberEmails: string[]
  onOpenMember: (email: string) => void
  /** The valid emails typed and not added yet, so the dialog counts them before they become chips. */
  onDraftChange: (draftEmails: string[]) => void
}) {
  const [inputEmail, setInputEmail] = useState("")
  const [inputError, setInputError] = useState<string | undefined>()
  const existing = new Set(existingMemberEmails)
  const existingInList = emails.filter((email) => existing.has(email))

  const addEmails = () => {
    // Pasting a list adds every address of it.
    const candidates = splitEmails(inputEmail)
    if (candidates.length === 0) return
    const invalid = candidates.find((candidate) => !isEmail(candidate))
    if (invalid) {
      setInputError(`"${invalid}" is not a valid email.`)
      return
    }
    onChange([...new Set([...emails, ...candidates])])
    setInputEmail("")
    onDraftChange([])
    setInputError(undefined)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addEmails()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id="invite-emails"
          type="text"
          inputMode="email"
          placeholder="name@example.org, another@example.org"
          value={inputEmail}
          onChange={(event) => {
            setInputEmail(event.target.value)
            setInputError(undefined)
            onDraftChange(splitEmails(event.target.value).filter(isEmail))
          }}
          onKeyDown={handleKeyDown}
          onBlur={addEmails}
          aria-invalid={inputError ? "true" : "false"}
        />
        <Button type="button" variant="outline" onClick={addEmails}>
          Add
        </Button>
      </div>
      {inputError && <p className="text-sm text-destructive">{inputError}</p>}

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((email) => (
            <Badge
              key={email}
              variant={existing.has(email) ? "secondary" : "outline"}
              className="gap-1 pr-1"
            >
              {existing.has(email) && (
                <TriangleAlertIcon className="size-3 text-muted-foreground" />
              )}
              {email}
              <button
                type="button"
                aria-label={`Remove ${email}`}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(emails.filter((candidate) => candidate !== email))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {existingInList.length > 0 && (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {existingInList.map((email) => (
            <p key={email}>
              {email} is already in this workspace and will not be invited.{" "}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => onOpenMember(email)}
              >
                Change their roles
              </Button>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
