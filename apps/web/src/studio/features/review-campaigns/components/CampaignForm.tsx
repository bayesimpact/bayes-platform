import type {
  CampaignAggregatesDto,
  ReviewCampaignMembershipDto,
  ReviewCampaignMembershipRole,
  ReviewCampaignQuestionDto,
  ReviewCampaignStatus,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { RocketIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { CampaignSummaryPanel } from "./CampaignSummaryPanel"
import { computeAutoCampaignName } from "./campaign-form.shared"
import { FeedbackPreview } from "./FeedbackPreview"
import { ParticipantsList } from "./ParticipantsList"
import { QuestionListEditor } from "./QuestionListEditor"

export type CampaignFormValues = {
  name: string
  description: string | null
  agentId: string
  testerPerSessionQuestions: ReviewCampaignQuestionDto[]
  testerEndOfPhaseQuestions: ReviewCampaignQuestionDto[]
  reviewerQuestions: ReviewCampaignQuestionDto[]
}

export type CampaignFormAgentOption = {
  id: string
  name: string
}

type Props = {
  mode: "create" | "edit"
  status: ReviewCampaignStatus
  agents: CampaignFormAgentOption[]
  defaultValues?: Partial<CampaignFormValues>
  memberships?: ReviewCampaignMembershipDto[]
  pendingInvitations?: PendingInvitations
  aggregates?: CampaignAggregatesDto | null
  onSubmit: (values: CampaignFormValues) => void
  onActivate?: () => void
  onClose?: () => void
  onDelete?: () => void
  onInviteMember?: (role: ReviewCampaignMembershipRole, emails: string[]) => void
  onRevokeMember?: (membershipId: string) => void
  onRevokeInvitation?: (invitationId: string) => void
  onOpenReport?: () => void
}

export function CampaignForm({
  mode,
  status,
  agents,
  defaultValues,
  memberships = [],
  pendingInvitations = [],
  aggregates = null,
  onSubmit,
  onActivate,
  onClose,
  onDelete,
  onInviteMember,
  onRevokeMember,
  onRevokeInvitation,
  onOpenReport,
}: Props) {
  const { t, i18n } = useTranslation()

  const schema = z.object({
    name: z.string().min(1, t("reviewCampaigns:editor.validation.nameRequired")),
    description: z.string().nullable(),
    agentId: z.string().min(1, t("reviewCampaigns:editor.validation.agentRequired")),
    testerPerSessionQuestions: z.array(z.any()),
    testerEndOfPhaseQuestions: z.array(z.any()),
    reviewerQuestions: z.array(z.any()),
  })

  const isDraft = status === "draft"
  const isActive = status === "active"
  const isClosed = status === "closed"
  const configLocked = !isDraft

  type TabValue = "summary" | "general" | "questions" | "participants" | "preview"
  const [tab, setTab] = useState<TabValue>(isClosed ? "summary" : "general")

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      agentId: defaultValues?.agentId ?? "",
      testerPerSessionQuestions: defaultValues?.testerPerSessionQuestions ?? [],
      testerEndOfPhaseQuestions: defaultValues?.testerEndOfPhaseQuestions ?? [],
      reviewerQuestions: defaultValues?.reviewerQuestions ?? [],
    },
  })

  const perSessionQuestions = watch("testerPerSessionQuestions")
  const endOfPhaseQuestions = watch("testerEndOfPhaseQuestions")
  const reviewerQuestions = watch("reviewerQuestions")

  // Agent-reactive auto-name (create mode only). When the user picks/changes
  // an agent and the current `name` still equals the last auto-generated
  // value (i.e. the user hasn't manually edited it), recompute the name
  // with the new agent's name.
  const watchedAgentId = useWatch({ control, name: "agentId" })
  const [lastAutoName, setLastAutoName] = useState(defaultValues?.name ?? "")
  useEffect(() => {
    if (mode !== "create") return
    const currentName = getValues("name")
    if (currentName !== lastAutoName && currentName !== "") return
    const agentName = agents.find((agent) => agent.id === watchedAgentId)?.name
    const nextName = computeAutoCampaignName({ t, language: i18n.language, agentName })
    if (nextName === currentName) return
    setValue("name", nextName, { shouldDirty: false })
    setLastAutoName(nextName)
  }, [mode, watchedAgentId, agents, t, i18n.language, getValues, setValue, lastAutoName])

  const submitHandler = handleSubmit((values) => {
    onSubmit({
      ...values,
      description: values.description?.trim() === "" ? null : values.description,
    })
  })

  return (
    <form onSubmit={submitHandler} className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">
            {mode === "create"
              ? t("reviewCampaigns:editor.createTitle")
              : t("reviewCampaigns:editor.editTitle")}
          </h2>
          <div>
            <CampaignStatusBadge status={status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && onDelete && (
            <Button type="button" variant="ghost" onClick={onDelete}>
              <Trash2Icon /> {t("reviewCampaigns:editor.actions.delete")}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isDraft && onActivate && (
              <Button type="button" variant="outline" onClick={onActivate}>
                <RocketIcon /> {t("reviewCampaigns:editor.actions.activate")}
              </Button>
            )}
            {isActive && onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                {t("reviewCampaigns:editor.actions.close")}
              </Button>
            )}
            {!configLocked && (
              <Button type="submit">
                {mode === "create"
                  ? t("reviewCampaigns:editor.actions.create")
                  : t("reviewCampaigns:editor.actions.save")}
              </Button>
            )}
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabsList>
          {isClosed && (
            <TabsTrigger value="summary">{t("reviewCampaigns:editor.tabs.summary")}</TabsTrigger>
          )}
          <TabsTrigger value="general">{t("reviewCampaigns:editor.tabs.general")}</TabsTrigger>
          <TabsTrigger value="questions">{t("reviewCampaigns:editor.tabs.questions")}</TabsTrigger>
          <TabsTrigger value="participants">
            {t("reviewCampaigns:editor.tabs.participants")}
          </TabsTrigger>
          <TabsTrigger value="preview">{t("reviewCampaigns:editor.tabs.preview")}</TabsTrigger>
        </TabsList>

        {isClosed && (
          <TabsContent value="summary" className="pt-4">
            <CampaignSummaryPanel aggregates={aggregates} onOpenReport={onOpenReport} />
          </TabsContent>
        )}

        <TabsContent value="general" className="pt-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{t("reviewCampaigns:editor.fields.name")}</FieldLabel>
              <Input
                id="name"
                disabled={configLocked}
                placeholder={t("reviewCampaigns:editor.fields.namePlaceholder")}
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </Field>

            <Field>
              <FieldLabel htmlFor="description">
                {t("reviewCampaigns:editor.fields.description")}
              </FieldLabel>
              <Textarea
                id="description"
                rows={3}
                disabled={configLocked}
                placeholder={t("reviewCampaigns:editor.fields.descriptionPlaceholder")}
                {...register("description")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="agentId">{t("reviewCampaigns:editor.fields.agent")}</FieldLabel>
              <Controller
                name="agentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={configLocked}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="agentId">
                      <SelectValue
                        placeholder={t("reviewCampaigns:editor.fields.agentPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.agentId && (
                <p className="text-destructive text-sm">{errors.agentId.message}</p>
              )}
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent value="questions" className="flex flex-col gap-6 pt-4">
          <QuestionListEditor
            label={t("reviewCampaigns:questions.perSession.label")}
            description={t("reviewCampaigns:questions.perSession.description")}
            questions={perSessionQuestions}
            disabled={configLocked}
            showFactualToggle
            onChange={(next) => setValue("testerPerSessionQuestions", next, { shouldDirty: true })}
          />
          <QuestionListEditor
            label={t("reviewCampaigns:questions.endOfPhase.label")}
            description={t("reviewCampaigns:questions.endOfPhase.description")}
            questions={endOfPhaseQuestions}
            disabled={configLocked}
            onChange={(next) => setValue("testerEndOfPhaseQuestions", next, { shouldDirty: true })}
          />
          <QuestionListEditor
            label={t("reviewCampaigns:questions.reviewer.label")}
            description={t("reviewCampaigns:questions.reviewer.description")}
            questions={reviewerQuestions}
            disabled={configLocked}
            onChange={(next) => setValue("reviewerQuestions", next, { shouldDirty: true })}
          />
        </TabsContent>

        <TabsContent value="participants" className="pt-4">
          {mode === "create" ? (
            <p className="text-muted-foreground text-sm italic">
              {t("reviewCampaigns:editor.noticeSaveFirst")}
            </p>
          ) : isDraft ? (
            <p className="text-muted-foreground text-sm italic">
              {t("reviewCampaigns:editor.noticeActivateFirst")}
            </p>
          ) : (
            <ParticipantsList
              memberships={memberships}
              pendingInvitations={pendingInvitations}
              disabled={isClosed}
              onInvite={(role, emails) => onInviteMember?.(role, emails)}
              onRevoke={(membershipId) => onRevokeMember?.(membershipId)}
              onRevokeInvitation={(invitationId) => onRevokeInvitation?.(invitationId)}
            />
          )}
        </TabsContent>

        <TabsContent value="preview" className="pt-4">
          <FeedbackPreview
            perSessionQuestions={perSessionQuestions}
            endOfPhaseQuestions={endOfPhaseQuestions}
          />
        </TabsContent>
      </Tabs>
    </form>
  )
}
