import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { ConversationAgentSessionType } from "../../base-agent-sessions/base-agent-sessions.types"
import { ExtractionAgentSession } from "../../extraction-agent-sessions/extraction-agent-session.entity"
import { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import { ConversationAgentSession } from "../conversation-agent-session.entity"

/**
 * The columns of a public session that the review shows. Loaded by entity name: importing the
 * PublicAgentSession entity here would be a cross-domain entity import
 * (no-cross-domain-entity-import), and the public-chat module already imports this one.
 */
export type PublicSessionRecord = {
  id: string
  agentId: string
  organizationId: string
  projectId: string
  appInstallationId: string | null
  externalVisitorId: string | null
  title: string | null
  purgedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** A session of any kind, as the review reads it. */
export type ReviewedSession =
  | { kind: "conversation"; session: ConversationAgentSession }
  | { kind: "public"; session: PublicSessionRecord }
  | { kind: "extraction"; session: ExtractionAgentSession }

/** One row of the review session list: enough to show and open a session, no content. */
export type ReviewSessionListRow = {
  sessionId: string
  kind: "conversation" | "public"
  conversationType: ConversationAgentSessionType | null
  isSubSession: boolean
  channel: "embed" | "app" | null
  categoryId: string | null
  categoryName: string
  createdAt: Date
}

/**
 * The conversation sessions a category tagged. The sessions carry the agent's own category
 * rows, matched through their `project_agent_session_category_id` link to the project category
 * requested ($4, a project category id). Scope: $1 organization, $2 project, $3 agent.
 */
const CATEGORIZED_CONVERSATION_SESSIONS_SQL = `
  SELECT
    s.id AS "sessionId",
    'conversation' AS "kind",
    s.type AS "conversationType",
    (s.parent_session_id IS NOT NULL) AS "isSubSession",
    NULL::varchar AS "channel",
    c.project_agent_session_category_id AS "categoryId",
    c.name AS "categoryName",
    s.created_at AS "createdAt"
  FROM "conversation_agent_session" AS s
  INNER JOIN "conversation_agent_session_category" AS sc
    ON sc.conversation_agent_session_id = s.id
  INNER JOIN "agent_session_category" AS c
    ON c.id = sc.agent_session_category_id
   AND c.deleted_at IS NULL
   AND c.project_agent_session_category_id = $4
  WHERE s.organization_id = $1
    AND s.project_id = $2
    AND s.agent_id = $3`

/** The conversation sessions no active category tagged. Scope: $1 organization, $2 project, $3 agent. */
const UNCATEGORIZED_CONVERSATION_SESSIONS_SQL = `
  SELECT
    s.id AS "sessionId",
    'conversation' AS "kind",
    s.type AS "conversationType",
    (s.parent_session_id IS NOT NULL) AS "isSubSession",
    NULL::varchar AS "channel",
    NULL::uuid AS "categoryId",
    'uncategorized' AS "categoryName",
    s.created_at AS "createdAt"
  FROM "conversation_agent_session" AS s
  WHERE s.organization_id = $1
    AND s.project_id = $2
    AND s.agent_id = $3
    AND NOT EXISTS (
      SELECT 1
      FROM "conversation_agent_session_category" AS sc
      INNER JOIN "agent_session_category" AS c
        ON c.id = sc.agent_session_category_id
       AND c.deleted_at IS NULL
      WHERE sc.conversation_agent_session_id = s.id
    )`

/** The public embed/app sessions a category tagged. Scope: $1 organization, $2 project, $3 agent, $4 category. */
const CATEGORIZED_PUBLIC_SESSIONS_SQL = `
  SELECT
    p.id AS "sessionId",
    'public' AS "kind",
    NULL::varchar AS "conversationType",
    FALSE AS "isSubSession",
    CASE WHEN p.app_installation_id IS NOT NULL THEN 'app' ELSE 'embed' END AS "channel",
    c.project_agent_session_category_id AS "categoryId",
    c.name AS "categoryName",
    p.created_at AS "createdAt"
  FROM "public_agent_session" AS p
  INNER JOIN "public_agent_session_category" AS psc
    ON psc.public_agent_session_id = p.id
  INNER JOIN "agent_session_category" AS c
    ON c.id = psc.agent_session_category_id
   AND c.deleted_at IS NULL
   AND c.project_agent_session_category_id = $4
  WHERE p.organization_id = $1
    AND p.project_id = $2
    AND p.agent_id = $3`

/** The public embed/app sessions no active category tagged. Scope: $1 organization, $2 project, $3 agent. */
const UNCATEGORIZED_PUBLIC_SESSIONS_SQL = `
  SELECT
    p.id AS "sessionId",
    'public' AS "kind",
    NULL::varchar AS "conversationType",
    FALSE AS "isSubSession",
    CASE WHEN p.app_installation_id IS NOT NULL THEN 'app' ELSE 'embed' END AS "channel",
    NULL::uuid AS "categoryId",
    'uncategorized' AS "categoryName",
    p.created_at AS "createdAt"
  FROM "public_agent_session" AS p
  WHERE p.organization_id = $1
    AND p.project_id = $2
    AND p.agent_id = $3
    AND NOT EXISTS (
      SELECT 1
      FROM "public_agent_session_category" AS psc
      INNER JOIN "agent_session_category" AS c
        ON c.id = psc.agent_session_category_id
       AND c.deleted_at IS NULL
      WHERE psc.public_agent_session_id = p.id
    )`

/**
 * Read-only access to any session of an agent, whoever had it. Unlike the session context
 * resolver, the lookup is not narrowed to the caller's own sessions: the route that uses it is
 * gated by the `agent.conversation.review` permission.
 */
@Injectable()
export class ConversationReviewRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * The three session tables share the id space of `agent_message.session_id`: the id names one
   * session at most, so the first table that has it wins.
   */
  async findSessionOfAgent(
    connectScope: RequiredConnectScope,
    { agentId, sessionId }: { agentId: string; sessionId: string },
  ): Promise<ReviewedSession | null> {
    const [conversationSession] = await this.conversationSessionConnectRepo().find(connectScope, {
      where: { id: sessionId, agentId },
      take: 1,
    })
    if (conversationSession) return { kind: "conversation", session: conversationSession }

    // Not a connect entity: the scope is matched on its own organization and project columns.
    const publicSession = await this.publicSessionRepo().findOne({
      where: {
        id: sessionId,
        agentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })
    if (publicSession) return { kind: "public", session: publicSession }

    const [extractionSession] = await this.extractionSessionConnectRepo().find(connectScope, {
      where: { id: sessionId, agentId },
      relations: { document: true },
      take: 1,
    })
    if (extractionSession) return { kind: "extraction", session: extractionSession }

    return null
  }

  /** Oldest first. Settles nothing: a review never writes to the conversation it reads. */
  listMessagesOfSession(
    connectScope: RequiredConnectScope,
    sessionId: string,
  ): Promise<AgentMessage[]> {
    return this.messageConnectRepo().find(connectScope, {
      where: { sessionId },
      order: { createdAt: "ASC" },
    })
  }

  /**
   * The agent's sessions for the review list, grouped by category: conversation sessions
   * (live, playground, review campaign testers) and public embed/app sessions, the ones the
   * requested category tagged — or, for a null category, the ones no active category tagged.
   *
   * `categoryId` is a project category id: the sessions are tagged with the agent's own category
   * rows, matched through their `project_agent_session_category_id` link to the project taxonomy.
   * A session tagged with several categories appears once per category, the way the category
   * analytics count it. Newest first, with the session id settling ties so pages stay stable.
   */
  async listSessionsOfAgentByCategory(
    connectScope: RequiredConnectScope,
    {
      agentId,
      categoryId,
      limit,
      offset,
    }: {
      agentId: string
      categoryId: string | null
      limit: number
      offset: number
    },
  ): Promise<{ rows: ReviewSessionListRow[]; total: number }> {
    const { dataSql, countSql, dataParameters, countParameters } = this.buildListedSessionsSql(
      connectScope,
      agentId,
      categoryId,
      limit,
      offset,
    )
    const [rows, counts] = await Promise.all([
      this.transactionService.getManager().query<ReviewSessionListRow[]>(dataSql, dataParameters),
      this.transactionService.getManager().query<{ total: number }[]>(countSql, countParameters),
    ])
    return { rows, total: counts[0]!.total }
  }

  /**
   * The two arms of the list (conversation, public) with the category match they carry,
   * each paired with the parameters its placeholders expect — the category arm binds
   * $4, the uncategorized arms do not.
   */
  private buildListedSessionsSql(
    connectScope: RequiredConnectScope,
    agentId: string,
    categoryId: string | null,
    limit: number,
    offset: number,
  ): {
    dataSql: string
    countSql: string
    dataParameters: (string | number | null)[]
    countParameters: (string | number | null)[]
  } {
    const categorized = categoryId !== null
    const coreParameters: (string | null)[] = [
      connectScope.organizationId,
      connectScope.projectId,
      agentId,
      ...(categorized ? [categoryId] : []),
    ]
    const coreSql = categorized
      ? `${CATEGORIZED_CONVERSATION_SESSIONS_SQL}
UNION ALL
${CATEGORIZED_PUBLIC_SESSIONS_SQL}`
      : `${UNCATEGORIZED_CONVERSATION_SESSIONS_SQL}
UNION ALL
${UNCATEGORIZED_PUBLIC_SESSIONS_SQL}`
    return {
      dataSql: `SELECT *
  FROM (${coreSql}) AS "rows"
  ORDER BY "rows"."createdAt" DESC, "rows"."sessionId" ASC
  LIMIT $${coreParameters.length + 1}
  OFFSET $${coreParameters.length + 2}`,
      countSql: `SELECT COUNT(*)::int AS "total"
  FROM (${coreSql}) AS "rows"`,
      dataParameters: [...coreParameters, limit, offset],
      countParameters: coreParameters,
    }
  }

  private conversationSessionConnectRepo(): ConnectRepository<ConversationAgentSession> {
    return new ConnectRepository(
      this.transactionService.getManager().getRepository(ConversationAgentSession),
      "conversationAgentSession",
    )
  }

  private extractionSessionConnectRepo(): ConnectRepository<ExtractionAgentSession> {
    return new ConnectRepository(
      this.transactionService.getManager().getRepository(ExtractionAgentSession),
      "extractionAgentSession",
    )
  }

  private messageConnectRepo(): ConnectRepository<AgentMessage> {
    return new ConnectRepository(
      this.transactionService.getManager().getRepository(AgentMessage),
      "agentMessage",
    )
  }

  private publicSessionRepo(): Repository<PublicSessionRecord> {
    return this.transactionService
      .getManager()
      .getRepository<PublicSessionRecord>("PublicAgentSession")
  }
}
