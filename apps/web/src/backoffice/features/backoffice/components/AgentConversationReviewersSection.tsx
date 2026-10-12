import {
  type GrantBackofficeAgentConversationReviewerRequestDto,
  grantBackofficeAgentConversationReviewerSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { selectCanUpdateConversationReviewers } from "@/common/features/me/me.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"
import type { BackofficeAgentConversationReviewer } from "../backoffice.models"
import { backofficeActions } from "../backoffice.slice"

/** The people allowed to read any conversation of this agent for safety review. */
export function AgentConversationReviewersSection({
  agentId,
  reviewers,
}: {
  agentId: string
  reviewers: BackofficeAgentConversationReviewer[]
}) {
  const canUpdate = useAppSelector(selectCanUpdateConversationReviewers)
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b space-y-0.5">
        <h3 className="text-sm font-medium text-muted-foreground">Conversation reviewers</h3>
        <p className="text-xs text-muted-foreground">
          Can read any conversation of this agent from its session id. Nobody by default.
        </p>
      </div>
      {reviewers.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center italic">
          No conversation reviewers
        </p>
      ) : (
        <ul className="divide-y">
          {reviewers.map((reviewer) => (
            <ReviewerRow
              key={reviewer.userId}
              agentId={agentId}
              reviewer={reviewer}
              canUpdate={canUpdate}
            />
          ))}
        </ul>
      )}
      {canUpdate && <GrantReviewerForm agentId={agentId} />}
    </div>
  )
}

function ReviewerRow({
  agentId,
  reviewer,
  canUpdate,
}: {
  agentId: string
  reviewer: BackofficeAgentConversationReviewer
  canUpdate: boolean
}) {
  const dispatch = useAppDispatch()
  const handleRevoke = () => {
    void dispatch(
      backofficeActions.revokeAgentConversationReviewer({ agentId, userId: reviewer.userId }),
    )
  }
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{reviewer.email}</span>
        <span className="text-xs text-muted-foreground">
          {reviewer.name ? `${reviewer.name} · ` : ""}since {buildDate(reviewer.grantedAt)}
        </span>
      </div>
      {canUpdate && (
        <Button variant="outline" size="sm" onClick={handleRevoke}>
          Revoke
        </Button>
      )}
    </li>
  )
}

function GrantReviewerForm({ agentId }: { agentId: string }) {
  const dispatch = useAppDispatch()
  const form = useForm<GrantBackofficeAgentConversationReviewerRequestDto>({
    resolver: zodResolver(grantBackofficeAgentConversationReviewerSchema),
    defaultValues: { email: "" },
  })

  const onValid = async ({ email }: GrantBackofficeAgentConversationReviewerRequestDto) => {
    const result = await dispatch(
      backofficeActions.grantAgentConversationReviewer({ agentId, email }),
    )
    if (backofficeActions.grantAgentConversationReviewer.fulfilled.match(result)) form.reset()
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="flex items-start gap-2 border-t px-4 py-3"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input {...field} placeholder="Email of an existing account" autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Grant
        </Button>
      </form>
    </Form>
  )
}
