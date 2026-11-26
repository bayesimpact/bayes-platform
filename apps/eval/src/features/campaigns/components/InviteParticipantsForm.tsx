import {
  CAMPAIGN_INVITATION_EMAILS_MAX,
  type ReviewCampaignParamsDto,
  reviewCampaignRoleSchema,
} from "@bayes-platform/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useInviteParticipants } from "../api/mutations"
import { inviteParticipantsFormSchema, parseEmails } from "../schemas"
import { CampaignRoleLabel } from "./CampaignRoleLabel"

export type InviteParticipantsFormProps = {
  campaign: ReviewCampaignParamsDto
}

/** Invites people to a campaign by email, all as testers or all as reviewers. */
export function InviteParticipantsForm({ campaign }: InviteParticipantsFormProps) {
  const { t, i18n } = useLingui()
  const emailsId = useId()
  const roleLabelId = useId()
  const testerId = useId()
  const reviewerId = useId()
  const invite = useInviteParticipants(campaign)
  const form = useForm({
    resolver: zodResolver(inviteParticipantsFormSchema),
    defaultValues: { emailsText: "", role: "tester" as const },
  })
  const maxEmails = i18n.number(CAMPAIGN_INVITATION_EMAILS_MAX)

  const handleSubmit = form.handleSubmit((values) =>
    invite.mutate(
      {
        emails: parseEmails(values.emailsText),
        role: values.role,
        // The API writes the invitation email in French or English: French for a person who
        // reads the app in French, English for any other language.
        language: i18n.locale === "fr" ? "fr" : "en",
      },
      {
        onSuccess: ({ invitations, emailSent }) => {
          form.reset({ emailsText: "", role: values.role })
          if (invitations.length === 0) {
            toast.info(t`These people already have access or an invitation.`)
          } else if (emailSent) {
            toast.success(t`The invitations were sent by email.`)
          } else {
            toast.success(t`The people were invited. Send them their invitation link.`)
          }
        },
        onError: () => toast.error(t`The people could not be invited. Try again.`),
      },
    ),
  )

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
      <Controller
        control={form.control}
        name="emailsText"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={emailsId}>
              <Trans>Email addresses, separated by commas or new lines</Trans>
            </FieldLabel>
            <Textarea
              {...field}
              id={emailsId}
              rows={3}
              placeholder="alex@example.org, sam@example.org"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid ? (
              <FieldError>
                <Trans>Write 1 to {maxEmails} valid email addresses.</Trans>
              </FieldError>
            ) : null}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <Field>
            <FieldLabel id={roleLabelId}>
              <Trans comment="The role people get in a review campaign">Role</Trans>
            </FieldLabel>
            <RadioGroup
              aria-labelledby={roleLabelId}
              value={field.value}
              onValueChange={(value) => {
                const role = reviewCampaignRoleSchema.safeParse(value)
                if (role.success) field.onChange(role.data)
              }}
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id={testerId} value="tester" />
                <Label htmlFor={testerId} className="font-normal">
                  <CampaignRoleLabel campaignRole="tester" />
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id={reviewerId} value="reviewer" />
                <Label htmlFor={reviewerId} className="font-normal">
                  <CampaignRoleLabel campaignRole="reviewer" />
                </Label>
              </div>
            </RadioGroup>
          </Field>
        )}
      />
      <Button type="submit" className="w-fit" disabled={invite.isPending}>
        <Trans>Invite</Trans>
      </Button>
    </form>
  )
}
