import {
  type ConversationReviewLookupDto,
  conversationReviewLookupSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

export function ConversationReviewLookupForm({
  onSubmit,
}: {
  onSubmit: (values: ConversationReviewLookupDto) => void
}) {
  const { t } = useTranslation()
  // The only way this field fails is a malformed id, so every issue reads the same.
  const resolver = useMemo(
    () =>
      zodResolver(conversationReviewLookupSchema, {
        error: () => t("conversationReview:form.invalid"),
      }),
    [t],
  )
  const form = useForm<ConversationReviewLookupDto>({
    resolver,
    defaultValues: { agentSessionId: "" },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-xl items-start gap-2">
        <FormField
          control={form.control}
          name="agentSessionId"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>{t("conversationReview:form.label")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("conversationReview:form.placeholder")}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="mt-6">
          {t("actions:open")}
        </Button>
      </form>
    </Form>
  )
}
