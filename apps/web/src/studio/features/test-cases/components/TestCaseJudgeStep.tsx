import { EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter } from "@caseai-connect/ui/shad/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@caseai-connect/ui/shad/field"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import type { EvaluationConversationDataset } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import type { TestCaseJudgement, TestCaseSource } from "../test-cases.models"
import { TestCaseAnswerPreview } from "./TestCaseAnswerPreview"

const NEW_DATASET = "new"

const judgeFormSchema = z
  .object({
    verdict: z.enum(["good", "bad"]),
    comment: z.string().trim(),
    datasetId: z.string(),
    newDatasetName: z.string().trim(),
  })
  // A bad answer's expected output is drafted from the comment; a good one can go without.
  .refine((values) => values.verdict !== "bad" || values.comment.length > 0, {
    path: ["comment"],
    message: "Say what is wrong with this answer.",
  })
  .refine(
    (values) =>
      values.datasetId !== NEW_DATASET ||
      values.newDatasetName.length >= EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH,
    {
      path: ["newDatasetName"],
      message: `A dataset name needs at least ${EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH} characters.`,
    },
  )

type JudgeFormValues = z.infer<typeof judgeFormSchema>

const VERDICT_CHOICES = [
  {
    value: "good",
    Icon: ThumbsUpIcon,
    title: "Good answer",
    description: "The answer becomes the reference the agent is graded against.",
  },
  {
    value: "bad",
    Icon: ThumbsDownIcon,
    title: "Bad answer",
    description: "Say what is wrong, and an LLM drafts the answer to aim for.",
  },
] as const

const COMMENT_FIELD = {
  good: {
    label: "What is good about this answer?",
    placeholder: "What the agent got right and must keep doing",
    description:
      "Optional. Kept with the test case, so whoever reads the dataset knows why this answer is the reference.",
  },
  bad: {
    label: "What is wrong with this answer?",
    placeholder: "What the agent got wrong, left out, or should not have said",
    description:
      "An LLM turns it into the answer the agent should have given. Kept with the test case.",
  },
} as const

/**
 * First step of saving a test case: is the answer good or bad, what makes it so, and which dataset gets the
 * record. Nothing is drafted until this is settled.
 */
export function TestCaseJudgeStep({
  source,
  datasets,
  judgement,
  onCancel,
  onSubmit,
}: {
  source: TestCaseSource
  datasets: EvaluationConversationDataset[]
  /** What the user settled before going back from the review, if they did. */
  judgement: TestCaseJudgement | null
  onCancel: () => void
  onSubmit: (judgement: TestCaseJudgement) => void
}) {
  const form = useForm<JudgeFormValues>({
    resolver: zodResolver(judgeFormSchema),
    defaultValues: toFormValues({ source, datasets, judgement }),
  })
  const verdict = useWatch({ control: form.control, name: "verdict" })
  const datasetId = useWatch({ control: form.control, name: "datasetId" })

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit((values) => onSubmit(toJudgement(values)))}
      >
        <TestCaseAnswerPreview answer={source.answer} />

        <FormField
          control={form.control}
          name="verdict"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is this the answer the agent should give?</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {VERDICT_CHOICES.map(({ value, Icon, title, description }) => (
                    <FieldLabel key={value} htmlFor={`test-case-verdict-${value}`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>
                            <Icon className="size-4" />
                            {title}
                          </FieldTitle>
                          <FieldDescription>{description}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value={value} id={`test-case-verdict-${value}`} />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{COMMENT_FIELD[verdict].label}</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder={COMMENT_FIELD[verdict].placeholder} {...field} />
              </FormControl>
              <FormDescription>
                {source.feedback && verdict === "bad"
                  ? "Taken from the user's report. Edit it if it misses the point."
                  : COMMENT_FIELD[verdict].description}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="datasetId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dataset</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                      <span className="text-muted-foreground">
                        {dataset.recordCount} {dataset.recordCount === 1 ? "record" : "records"}
                      </span>
                    </SelectItem>
                  ))}
                  {datasets.length > 0 && <SelectSeparator />}
                  <SelectItem value={NEW_DATASET}>
                    <PlusIcon className="size-3.5" />
                    New dataset
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {datasetId === NEW_DATASET && (
          <FormField
            control={form.control}
            name="newDatasetName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New dataset name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter dataset name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Next</Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function toFormValues({
  source,
  datasets,
  judgement,
}: {
  source: TestCaseSource
  datasets: EvaluationConversationDataset[]
  judgement: TestCaseJudgement | null
}): JudgeFormValues {
  if (judgement) {
    return {
      verdict: judgement.verdict,
      comment: judgement.comment,
      datasetId: judgement.target.kind === "existing" ? judgement.target.datasetId : NEW_DATASET,
      newDatasetName: judgement.target.kind === "new" ? judgement.target.name : "",
    }
  }
  // A report from the Feedback page already says what went wrong, so it starts as a bad answer.
  return {
    verdict: source.feedback ? "bad" : "good",
    comment: source.feedback ?? "",
    datasetId: datasets[0]?.id ?? NEW_DATASET,
    newDatasetName: "",
  }
}

function toJudgement(values: JudgeFormValues): TestCaseJudgement {
  return {
    verdict: values.verdict,
    comment: values.comment,
    target:
      values.datasetId === NEW_DATASET
        ? { kind: "new", name: values.newDatasetName }
        : { kind: "existing", datasetId: values.datasetId },
  }
}
