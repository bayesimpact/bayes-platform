import { CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import type { TFunction } from "i18next"
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useValue } from "@/common/hooks/use-value"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"
import type { ConversationReviewSessionRow } from "../conversation-review.models"
import {
  selectConversationReviewSelectedSessionId,
  selectConversationReviewSessions,
  selectConversationReviewSessionsCategoryId,
} from "../conversation-review.selectors"
import { conversationReviewActions } from "../conversation-review.slice"
import {
  loadConversationReview,
  loadConversationReviewSessions,
} from "../conversation-review.thunks"

const shortenId = (id: string) => `${id.slice(0, 8)}…`

/**
 * The "by category" tab of the safety review screen: pick a category of the project, page
 * through the sessions it tagged, click one to read it in the review panel on the right.
 */
export function ReviewSessionsByCategory() {
  const { t } = useTranslation("conversationReview")
  const dispatch = useAppDispatch()
  const project = useValue(selectCurrentProjectData)
  const sessions = useAppSelector(selectConversationReviewSessions)
  const categoryId = useAppSelector(selectConversationReviewSessionsCategoryId)
  const selectedSessionId = useAppSelector(selectConversationReviewSelectedSessionId)

  const categories = project?.agentSessionCategories ?? []
  const selectValue =
    categoryId === undefined
      ? undefined
      : categoryId === null
        ? CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY
        : categoryId

  const handleCategoryChange = (value: string) => {
    const nextCategoryId = value === CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY ? null : value
    dispatch(conversationReviewActions.selectSessionCategory(nextCategoryId))
    void dispatch(loadConversationReviewSessions({ categoryId: nextCategoryId, page: 1 }))
  }

  const handleSelectSession = (sessionId: string) => {
    if (sessionId === selectedSessionId) return
    dispatch(conversationReviewActions.selectSession(sessionId))
    void dispatch(loadConversationReview({ agentSessionId: sessionId }))
  }

  if (categoryId === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <CategorySelect
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
          }))}
          value={selectValue}
          onSelect={handleCategoryChange}
          t={t}
        />
        <p className="text-sm italic text-muted-foreground">{t("byCategory.chooseCategory")}</p>
      </div>
    )
  }

  if (ADS.isLoading(sessions)) return <Spinner />
  if (ADS.isError(sessions)) {
    return <p className="text-sm text-destructive">{t("byCategory.error")}</p>
  }
  const page = sessions.value
  if (!page) return null

  if (page.sessions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <CategorySelect
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
          }))}
          value={selectValue}
          onSelect={handleCategoryChange}
          t={t}
        />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>{t("byCategory.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("byCategory.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CategorySelect
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        value={selectValue}
        onSelect={handleCategoryChange}
        t={t}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("byCategory.table.date")}</TableHead>
            <TableHead>{t("byCategory.table.type")}</TableHead>
            <TableHead>{t("byCategory.table.session")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.sessions.map((row) => (
            <TableRow
              key={row.sessionId}
              data-state={selectedSessionId === row.sessionId ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => handleSelectSession(row.sessionId)}
            >
              <TableCell>{buildDate(row.createdAt)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="w-fit text-xs">
                  {rowTypeLabel(row, t)}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{shortenId(row.sessionId)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <SessionListPagination
        page={page.page}
        total={page.total}
        limit={page.limit}
        onPageChange={(nextPage) =>
          void dispatch(
            loadConversationReviewSessions({ categoryId: categoryId ?? null, page: nextPage }),
          )
        }
        t={t}
      />
    </div>
  )
}

function CategorySelect({
  categories,
  value,
  onSelect,
  t,
}: {
  categories: { id: string; name: string }[]
  value: string | undefined
  onSelect: (value: string) => void
  t: TFunction
}) {
  return (
    <Select value={value} onValueChange={onSelect}>
      <SelectTrigger className="w-fit">
        <SelectValue placeholder={t("byCategory.select.placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
        <SelectItem value={CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY}>
          {t("byCategory.select.uncategorized")}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function SessionListPagination({
  page,
  total,
  limit,
  onPageChange,
  t,
}: {
  page: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  t: TFunction
}) {
  const pageCount = Math.max(1, Math.ceil(total / limit))
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {t("byCategory.pagination.count", { page, pages: pageCount, total })}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
          {t("byCategory.pagination.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {t("byCategory.pagination.next")}
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}

function rowTypeLabel(row: ConversationReviewSessionRow, t: TFunction): string {
  if (row.kind === "public") return t(`channel.${row.channel ?? "embed"}`)
  const base = t(`session.${row.conversationType ?? "live"}`)
  return row.isSubSession ? `${base} · ${t("session.subSession")}` : base
}
