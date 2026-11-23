import type {
  AgentParamsDto,
  ReviewCampaignListItemOutputDto,
} from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Link } from "@tanstack/react-router"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { CampaignStatusBadge } from "@/components/shared/CampaignStatusBadge"
import { fullDateTimeOf } from "@/lib/format-time"

const columnHelper = createColumnHelper<ReviewCampaignListItemOutputDto>()

/** The texts of the headers, which the table translates. */
const campaignColumnLabels = {
  name: msg({ message: "Name", comment: "The name of a review campaign" }),
  status: msg({ message: "Status", comment: "Where a review campaign stands" }),
  members: msg({ message: "Participants", comment: "How many people take part in a campaign" }),
  created: msg({ message: "Created", comment: "When a review campaign was created" }),
  updated: msg({ message: "Updated", comment: "When a review campaign last changed" }),
} satisfies Record<string, MessageDescriptor>

/** The columns of the campaigns of an agent: its name opens it. */
export function campaignColumnsOf({
  agent,
  locale,
  translate,
}: {
  agent: AgentParamsDto
  locale: string
  translate: (descriptor: MessageDescriptor) => string
}): ColumnDef<ReviewCampaignListItemOutputDto, unknown>[] {
  // Each helper call types its own value: the list holds them as columns of any value.
  return [
    columnHelper.accessor("name", {
      header: translate(campaignColumnLabels.name),
      cell: (context) => (
        <Link
          to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId"
          params={{ ...agent, reviewCampaignId: context.row.original.id }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {context.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("status", {
      header: translate(campaignColumnLabels.status),
      cell: (context) => <CampaignStatusBadge status={context.getValue()} />,
    }),
    columnHelper.accessor("memberCount", {
      header: translate(campaignColumnLabels.members),
      cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
    }),
    columnHelper.accessor("createdAt", {
      header: translate(campaignColumnLabels.created),
      cell: (context) => (
        <span className="text-muted-foreground">{fullDateTimeOf(context.getValue(), locale)}</span>
      ),
    }),
    columnHelper.accessor("updatedAt", {
      header: translate(campaignColumnLabels.updated),
      cell: (context) => (
        <span className="text-muted-foreground">{fullDateTimeOf(context.getValue(), locale)}</span>
      ),
    }),
  ] as ColumnDef<ReviewCampaignListItemOutputDto, unknown>[]
}
