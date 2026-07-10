import {
  AgentModel,
  AgentModelToAgentProvider,
  AgentProvider,
  updateAgentModelSchema,
} from "@caseai-connect/api-contracts"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { updateAgentModel } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"

type FormValues = z.infer<typeof updateAgentModelSchema>

function extractModelList(
  hasFeature: ReturnType<typeof useFeatureFlags>["hasFeature"],
): [string, AgentModel][] {
  const defaultModels = Object.entries(AgentModel).filter(
    ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Vertex,
  ) as [string, AgentModel][]
  let mistralModels: [string, AgentModel][] = []
  let vertex3Models: [string, AgentModel][] = []
  let medGemmaModels: [string, AgentModel][] = []
  let gemmaModels: [string, AgentModel][] = []
  if (hasFeature("mistral")) {
    mistralModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Mistral,
    ) as [string, AgentModel][]
  }
  if (hasFeature("vertex-3")) {
    vertex3Models = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Vertex3,
    ) as [string, AgentModel][]
  }
  if (hasFeature("gemma")) {
    gemmaModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Gemma,
    ) as [string, AgentModel][]
  }
  if (hasFeature("medgemma")) {
    medGemmaModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.MedGemma,
    ) as [string, AgentModel][]
  }
  return [...defaultModels, ...medGemmaModels, ...gemmaModels, ...vertex3Models, ...mistralModels]
}

export function AgentModelTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const models = extractModelList(hasFeature)

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentModelSchema),
    defaultValues: { model: agent.model, temperature: agent.temperature },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  const handleSubmit = form.handleSubmit(async (values) => {
    await dispatch(updateAgentModel({ agentId: agent.id, fields: values })).unwrap()
    form.reset(values)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.model")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("agent:props.placeholders.model")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {models.map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.temperature")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="2"
                    placeholder={t("agent:props.placeholders.temperature")}
                    {...field}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
        />
      </form>
    </Form>
  )
}
