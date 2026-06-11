import type { ReviewCampaignTesterContextDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { ArrowRightIcon, CheckCircle2Icon, FlagIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import type { MyTesterSessionSummary } from "../tester.models"
import { selectTesterContext } from "../tester.selectors"
import { startTesterSession } from "../tester.thunks"
import { SessionCard } from "./SessionCard"

type Props = {
  context: ReviewCampaignTesterContextDto
  sessions: MyTesterSessionSummary[]
  participationFinished: boolean
  onOpenFeedback: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
  onFinishParticipating: () => void
  onEditSurvey: () => void
}

export function CampaignLanding({
  context,
  sessions,
  participationFinished,
  onOpenFeedback,
  onDeleteSession,
  onResumeSession,
  onFinishParticipating,
  onEditSurvey,
}: Props) {
  const navigate = useNavigate()
  const handleBack = () => {
    const path = TesterRoutes.home.path
    navigate(path)
  }
  return (
    <div className="flex flex-col gap-6">
      <GridHeader onBack={handleBack} title={context.name} description={context.description} />

      <div className="flex flex-col gap-6 px-6 pb-6">
        {!participationFinished && <StartSessionButton />}

        <Sessions
          sessions={sessions}
          onOpenFeedback={onOpenFeedback}
          onDeleteSession={onDeleteSession}
          onResumeSession={onResumeSession}
        />

        <SurveyButton
          onFinish={onFinishParticipating}
          participationFinished={participationFinished}
          onEdit={onEditSurvey}
        />
      </div>
    </div>
  )
}

function Sessions({
  sessions,
  onOpenFeedback,
  onDeleteSession,
  onResumeSession,
}: {
  sessions: MyTesterSessionSummary[]
  onOpenFeedback: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("testerCampaigns:landing.pastSessions.title")}</h2>
        <span className="text-muted-foreground text-sm">
          {t("testerCampaigns:landing.pastSessions.count", { count: sessions.length })}
        </span>
      </header>
      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">
          {t("testerCampaigns:landing.pastSessions.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onOpenFeedback={onOpenFeedback}
              onDelete={onDeleteSession}
              onResume={onResumeSession}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SurveyButton({
  onFinish,
  participationFinished,
  onEdit,
}: {
  onFinish: () => void
  participationFinished: boolean
  onEdit: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <FlagIcon className="size-4" /> {t("testerCampaigns:landing.endOfPhase.title")}
      </h2>
      {participationFinished ? (
        <>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-green-600" />{" "}
            {t("testerCampaigns:landing.endOfPhase.finishedMessage")}
          </p>
          <div>
            <Button variant="outline" onClick={onEdit}>
              {t("testerCampaigns:landing.endOfPhase.editSurvey")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {t("testerCampaigns:landing.endOfPhase.description")}
          </p>
          <div>
            <Button onClick={onFinish}>
              {t("testerCampaigns:landing.endOfPhase.finishParticipating")}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

function StartSessionButton() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const context = useValue(selectTesterContext)

  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)

  const handleSuccess = (sessionId: string) => {
    navigate(
      TesterRoutes.session.build({
        organizationId,
        projectId,
        reviewCampaignId,
        agentId: context.agent.id,
        agentSessionId: sessionId,
      }),
    )
  }

  const handleStartSession = () => {
    dispatch(startTesterSession({ onSuccess: handleSuccess }))
  }
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{context.agent.name}</CardTitle>
        <CardDescription>
          <Badge variant="outline">
            {t(`testerCampaigns:landing.agentTypeLabel.${context.agent.type}`)}
          </Badge>
        </CardDescription>
        <CardAction>
          <Button onClick={handleStartSession}>
            {t("testerCampaigns:landing.startSession")} <ArrowRightIcon />
          </Button>
        </CardAction>
      </CardHeader>

      {context.agent.greetingMessage && (
        <CardContent>
          <p className="text-muted-foreground text-sm italic">“{context.agent.greetingMessage}”</p>
        </CardContent>
      )}
    </Card>
  )
}
