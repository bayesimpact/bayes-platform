import { plural } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { MailIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAnswerInvitation } from "../api/mutations"
import { myInvitationsQueryOptions } from "../api/queries"
import { InvitationItem } from "./InvitationItem"

/**
 * An envelope at the bottom of the sidebar, with the number of the person's pending invitations:
 * it opens them, to accept or decline each one. Without an invitation, there is no envelope.
 */
export function InvitationsButton() {
  const { t } = useLingui()
  // useQuery: a badge, which must not hold the sidebar back nor break it when it fails.
  const { data: invitations = [] } = useQuery(myInvitationsQueryOptions())
  const answer = useAnswerInvitation()
  const count = invitations.length
  const [isOpen, setIsOpen] = useState(false)

  const label = t({
    message: plural(count, { one: "# pending invitation", other: "# pending invitations" }),
  })

  if (count === 0) return null
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="relative shrink-0 transition-colors duration-200 ease-out hover:bg-foreground hover:text-background aria-expanded:bg-foreground aria-expanded:text-background"
          />
        }
      >
        <MailIcon aria-hidden />
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs leading-4 font-medium text-primary-foreground ring-2 ring-background"
        >
          {count}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 gap-0 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">
            <Trans>Invitations</Trans>
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <ul className="flex max-h-96 flex-col divide-y overflow-y-auto">
          {invitations.map((invitation) => (
            <InvitationItem
              key={invitation.id}
              invitation={invitation}
              isAnswering={answer.isPending && answer.variables?.invitationId === invitation.id}
              onAnswer={(choice) =>
                answer.mutate(
                  {
                    invitationId: invitation.id,
                    targetName: invitation.targetName,
                    answer: choice,
                  },
                  // The last answer leaves nothing to show: the box closes with it.
                  { onSuccess: () => setIsOpen(count > 1) },
                )
              }
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
