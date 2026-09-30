import { Injectable, Logger } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { metrics } from "@opentelemetry/api"
import type { Repository } from "typeorm"
import { ConversationAgentSession } from "../conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionPurgeService } from "./conversation-agent-session-purge.service"
import {
  CONVERSATION_RETENTION_SWEEP_BATCH_LIMIT,
  CONVERSATION_RETENTION_SWEEP_LOG_RETENTION_MONTHS,
  CONVERSATION_RETENTION_SWEEP_MAX_BATCHES_PER_RUN,
} from "./conversation-retention.constants"
import {
  ConversationRetentionSweepRun,
  type ConversationRetentionSweepRunStatus,
} from "./conversation-retention-sweep-run.entity"

type SweepRunStatus = ConversationRetentionSweepRunStatus

/** Per-project tally of one sweep run, accumulated across both session kinds. */
type ProjectTally = {
  conversationCount: number
  publicSessionCount: number
  failedCount: number
}

// Traces are out of the purge's scope on purpose: observability data gets its
// own global TTL, applied on the observability store directly.

@Injectable()
export class ConversationRetentionSweepService {
  private readonly logger = new Logger(ConversationRetentionSweepService.name)

  private readonly meter = metrics.getMeter("retention-sweep")
  private readonly runsCounter = this.meter.createCounter("retention.sweep.runs", {
    description: "Retention sweep runs, by worst status (OK | PARTIAL | ERROR)",
  })
  private readonly purgedSessionsCounter = this.meter.createCounter(
    "retention.sweep.purged_sessions",
    { description: "Sessions whose content the retention sweep purged" },
  )
  private readonly durationHistogram = this.meter.createHistogram("retention.sweep.duration", {
    description: "Duration of a retention sweep run",
    unit: "ms",
  })

  constructor(
    @InjectRepository(ConversationAgentSession)
    private readonly sessionRepository: Repository<ConversationAgentSession>,
    @InjectRepository(ConversationRetentionSweepRun)
    private readonly sweepRunRepository: Repository<ConversationRetentionSweepRun>,
    private readonly purgeService: ConversationAgentSessionPurgeService,
  ) {}

  async sweepExpiredConversations(): Promise<{ purgedCount: number }> {
    const ranAt = new Date()
    const startedAt = Date.now()
    // Sessions whose purge failed in this run. They keep purged_at empty, so
    // the next nightly run selects and retries them; the in-run exclusion only
    // stops them from filling every batch of THIS run.
    const failedSessionIds = new Set<string>()
    const tallies = new Map<string, ProjectTally>()
    let purgedCount = 0

    try {
      for (let batch = 0; batch < CONVERSATION_RETENTION_SWEEP_MAX_BATCHES_PER_RUN; batch++) {
        const expiredSessions = await this.findExpiredSessionsBatch(failedSessionIds)
        if (expiredSessions.length === 0) break
        purgedCount += await this.purgeBatch(expiredSessions, failedSessionIds, tallies)
        if (expiredSessions.length < CONVERSATION_RETENTION_SWEEP_BATCH_LIMIT) break
      }

      purgedCount += await this.sweepExpiredPublicSessions(failedSessionIds, tallies)
    } catch (error) {
      this.recordRunMetrics("ERROR", purgedCount, startedAt)
      await this.writeRunLog(ranAt, tallies, {
        error: `The run failed: ${(error as Error).message}`,
      })
      throw error
    }

    this.recordRunMetrics(failedSessionIds.size > 0 ? "PARTIAL" : "OK", purgedCount, startedAt)
    await this.writeRunLog(ranAt, tallies, {})
    await this.deleteExpiredLogRows()

    if (purgedCount > 0 || failedSessionIds.size > 0) {
      this.logger.log(
        `Retention sweep purged ${purgedCount} conversation session(s), ` +
          `${failedSessionIds.size} failed and left for the next run.`,
      )
    }
    return { purgedCount }
  }

  /** Embed (public) sessions follow the same per-project retention rule. */
  private async sweepExpiredPublicSessions(
    failedSessionIds: Set<string>,
    tallies: Map<string, ProjectTally>,
  ): Promise<number> {
    let purgedCount = 0
    for (let batch = 0; batch < CONVERSATION_RETENTION_SWEEP_MAX_BATCHES_PER_RUN; batch++) {
      const expiredSessions = await this.findExpiredPublicSessionsBatch(failedSessionIds)
      if (expiredSessions.length === 0) break
      purgedCount += await this.purgePublicBatch(expiredSessions, failedSessionIds, tallies)
      if (expiredSessions.length < CONVERSATION_RETENTION_SWEEP_BATCH_LIMIT) break
    }
    return purgedCount
  }

  private async findExpiredSessionsBatch(
    excludedSessionIds: Set<string>,
  ): Promise<ConversationAgentSession[]> {
    const query = this.sessionRepository
      .createQueryBuilder("session")
      // Joined by table name: importing the Project entity here would be a
      // cross-domain entity import (no-cross-domain-entity-import).
      .innerJoin("project", "project", "project.id = session.project_id")
      .where("session.purged_at IS NULL")
      // Review-campaign sessions are test material, reviewed long after they
      // happen: they stay out of the retention purge until session kinds are
      // differentiated (#617).
      .andWhere("session.campaign_id IS NULL")
      .andWhere(
        "session.created_at < now() - (project.conversation_retention_days * interval '1 day')",
      )
    if (excludedSessionIds.size > 0) {
      query.andWhere("session.id NOT IN (:...excludedSessionIds)", {
        excludedSessionIds: [...excludedSessionIds],
      })
    }
    return query
      .orderBy("session.created_at", "ASC")
      .limit(CONVERSATION_RETENTION_SWEEP_BATCH_LIMIT)
      .getMany()
  }

  // Queried by table name: importing the PublicAgentSession entity here would
  // be a cross-domain entity import (no-cross-domain-entity-import). A raw
  // FROM also skips the soft-delete filter, hence the deleted_at clause.
  private async findExpiredPublicSessionsBatch(
    excludedSessionIds: Set<string>,
  ): Promise<{ id: string; projectId: string }[]> {
    const query = this.sessionRepository.manager
      .createQueryBuilder()
      .select("session.id", "id")
      .addSelect("session.project_id", "projectId")
      .from("public_agent_session", "session")
      .innerJoin("project", "project", "project.id = session.project_id")
      .where("session.purged_at IS NULL")
      .andWhere("session.deleted_at IS NULL")
      .andWhere(
        "session.created_at < now() - (project.conversation_retention_days * interval '1 day')",
      )
    if (excludedSessionIds.size > 0) {
      query.andWhere("session.id NOT IN (:...excludedSessionIds)", {
        excludedSessionIds: [...excludedSessionIds],
      })
    }
    return query
      .orderBy("session.created_at", "ASC")
      .limit(CONVERSATION_RETENTION_SWEEP_BATCH_LIMIT)
      .getRawMany()
  }

  private async purgeBatch(
    expiredSessions: ConversationAgentSession[],
    failedSessionIds: Set<string>,
    tallies: Map<string, ProjectTally>,
  ): Promise<number> {
    let purgedCount = 0
    for (const session of expiredSessions) {
      const tally = this.tallyFor(tallies, session.projectId)
      const purged = await this.purgeOne(
        () => this.purgeService.purgeSessionContent(session.id),
        session.id,
        failedSessionIds,
        tally,
      )
      if (purged) {
        purgedCount += 1
        tally.conversationCount += 1
      }
    }

    return purgedCount
  }

  private async purgePublicBatch(
    expiredSessions: { id: string; projectId: string }[],
    failedSessionIds: Set<string>,
    tallies: Map<string, ProjectTally>,
  ): Promise<number> {
    let purgedCount = 0
    for (const session of expiredSessions) {
      const tally = this.tallyFor(tallies, session.projectId)
      const purged = await this.purgeOne(
        () => this.purgeService.purgePublicSessionContent(session.id),
        session.id,
        failedSessionIds,
        tally,
      )
      if (purged) {
        purgedCount += 1
        tally.publicSessionCount += 1
      }
    }

    return purgedCount
  }

  /**
   * One session's purge must not sink the whole run: a failure marks the run
   * PARTIAL, the session keeps purged_at empty, and the next nightly run
   * retries it. Returns whether the session was purged.
   */
  private async purgeOne(
    purge: () => Promise<{ purged: boolean }>,
    sessionId: string,
    failedSessionIds: Set<string>,
    tally: ProjectTally,
  ): Promise<boolean> {
    try {
      const { purged } = await purge()
      return purged
    } catch (error) {
      failedSessionIds.add(sessionId)
      tally.failedCount += 1
      this.logger.error(
        `Purge failed for session ${sessionId}; retried on the next run: ${(error as Error).message}`,
      )
      return false
    }
  }

  private tallyFor(tallies: Map<string, ProjectTally>, projectId: string): ProjectTally {
    let tally = tallies.get(projectId)
    if (!tally) {
      tally = { conversationCount: 0, publicSessionCount: 0, failedCount: 0 }
      tallies.set(projectId, tally)
    }
    return tally
  }

  /**
   * Purge log (#677): one row per project on every run, zero counts included
   * so the log proves that the purge ran. On a crashed run the rows carry the
   * ERROR status and the error message.
   */
  private async writeRunLog(
    ranAt: Date,
    tallies: Map<string, ProjectTally>,
    { error }: { error?: string },
  ): Promise<void> {
    try {
      const projectRows: { id: string }[] = await this.sessionRepository.manager.query(
        `SELECT id FROM project WHERE deleted_at IS NULL`,
      )
      const rows = projectRows.map(({ id }) => {
        const tally = tallies.get(id) ?? {
          conversationCount: 0,
          publicSessionCount: 0,
          failedCount: 0,
        }
        const status: SweepRunStatus = error ? "ERROR" : tally.failedCount > 0 ? "PARTIAL" : "OK"
        return this.sweepRunRepository.create({
          projectId: id,
          ranAt,
          purgedCount: tally.conversationCount + tally.publicSessionCount,
          status,
          report: error ?? this.buildReport(tally),
        })
      })
      await this.sweepRunRepository.insert(rows)
    } catch (logError) {
      // The log must never break the purge itself (nor mask its error).
      this.logger.error(`Could not write the sweep run log: ${(logError as Error).message}`)
    }
  }

  private buildReport(tally: ProjectTally): string {
    const lines = [
      `- Conversations purged: ${tally.conversationCount}`,
      `- Embed sessions purged: ${tally.publicSessionCount}`,
    ]
    if (tally.failedCount > 0) {
      lines.push(`- Purge failures: ${tally.failedCount} (retried on the next run)`)
    }
    return lines.join("\n")
  }

  /** The log has its own retention: rows older than 12 months are deleted. */
  private async deleteExpiredLogRows(): Promise<void> {
    await this.sweepRunRepository
      .createQueryBuilder()
      .delete()
      .where(
        `ran_at < now() - interval '${CONVERSATION_RETENTION_SWEEP_LOG_RETENTION_MONTHS} months'`,
      )
      .execute()
  }

  private recordRunMetrics(status: SweepRunStatus, purgedCount: number, startedAt: number): void {
    this.runsCounter.add(1, { status })
    if (purgedCount > 0) this.purgedSessionsCounter.add(purgedCount)
    this.durationHistogram.record(Date.now() - startedAt)
  }
}
