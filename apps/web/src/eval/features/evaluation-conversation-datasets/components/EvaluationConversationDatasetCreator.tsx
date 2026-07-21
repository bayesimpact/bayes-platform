import {
  EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH,
  evaluationConversationDatasetNameSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
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
import { PlusCircleIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"

export function EvaluationConversationDatasetCreator() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="text-base">
          {t("actions:create")}
          <PlusCircleIcon className="ml-2 size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <FormCreation onSubmit={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

type FormValues = z.infer<typeof evaluationConversationDatasetNameSchema>

function FormCreation({ onSubmit }: { onSubmit: () => void }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  // Contract schema + UI-only minimum-length rule with a translated message (ADR 0012).
  const schema = useMemo(
    () =>
      evaluationConversationDatasetNameSchema.refine(
        (values) => values.name.length >= EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH,
        { path: ["name"], message: t("evaluationConversationDataset:validation.minNameLength") },
      ),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })

  const handleFormSubmit = (data: FormValues) => {
    dispatch(evaluationConversationDatasetsActions.createOne({ name: data.name }))
    form.reset()
    onSubmit()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)}>
        <DialogHeader>
          <DialogTitle>{t("evaluationConversationDataset:dataset.create.title")}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("evaluationConversationDataset:dataset.props.name")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("evaluationConversationDataset:dataset.props.placeholders.name")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("actions:create")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
