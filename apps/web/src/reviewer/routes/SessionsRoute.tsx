import { useOutlet } from "react-router-dom"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { CampaignSessionList } from "../features/review-campaigns/components/CampaignSessionList"
import { selectReviewerSessions } from "../features/review-campaigns/reviewer.selectors"

export function SessionsRoute() {
  const sessions = useAppSelector(selectReviewerSessions)
  return (
    <AsyncRoute data={[sessions]}>
      <WithData />
    </AsyncRoute>
  )
}
function WithData() {
  const outlet = useOutlet()
  if (outlet) return outlet
  return <CampaignSessionList />
}
