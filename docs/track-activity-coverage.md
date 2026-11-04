# Endpoints without activity tracking

This page lists every API controller endpoint that has no `@TrackActivity` decorator, so calling it writes no row to the activities table. It is a snapshot of `main` at commit `ab0977ab`.

Out of 212 endpoints across 48 controllers, 67 are tracked and 145 are not. No controller applies the decorator at class level, so tracking is always set per handler. Only `domains/agents/session-categories/project-agent-session-categories.controller.ts` tracks every endpoint.

Paths are relative to the API root, with the `api-contracts` route constants resolved. The HTTP method alone does not tell reads from writes here: several list and detail handlers use POST.

## common/diagnostics/diagnostics.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/diagnostics/:secret/test-error` | [`testError`](../apps/api/src/common/diagnostics/diagnostics.controller.ts#L7) |

## common/health/health.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/healthz` | [`check`](../apps/api/src/common/health/health.controller.ts#L18) |

## common/workers-health/workers-health.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/healthz` | [`check`](../apps/api/src/common/workers-health/workers-health.controller.ts#L19) |

## domains/agents/agents.controller.ts

3 of 7 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/agents` | [`getAll`](../apps/api/src/domains/agents/agents.controller.ts#L70) |
| GET | `/organizations/:organizationId/projects/:projectId/agents-with-drafts` | [`getAllWithDrafts`](../apps/api/src/domains/agents/agents.controller.ts#L92) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/sub-agents` | [`getAllSubAgents`](../apps/api/src/domains/agents/agents.controller.ts#L160) |

## domains/agents/conversation-agent-sessions/conversation-agent-sessions.controller.ts

3 of 4 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions` | [`getAll`](../apps/api/src/domains/agents/conversation-agent-sessions/conversation-agent-sessions.controller.ts#L43) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions/:agentSessionId/delete` | [`deleteOne`](../apps/api/src/domains/agents/conversation-agent-sessions/conversation-agent-sessions.controller.ts#L82) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/sub-sessions` | [`listSubSessions`](../apps/api/src/domains/agents/conversation-agent-sessions/conversation-agent-sessions.controller.ts#L96) |

## domains/agents/conversation-agent-sessions/retention/conversation-retention-sweep-runs.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/retention-sweep-runs` | [`listRuns`](../apps/api/src/domains/agents/conversation-agent-sessions/retention/conversation-retention-sweep-runs.controller.ts#L30) |

## domains/agents/csv-extraction-runs/agent-csv-extraction-runs.controller.ts

5 of 10 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/:agentCsvExtractionRunId` | [`getOne`](../apps/api/src/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.controller.ts#L240) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs` | [`getAll`](../apps/api/src/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.controller.ts#L249) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/:agentCsvExtractionRunId/records` | [`getRecords`](../apps/api/src/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.controller.ts#L264) |
| GET (SSE) | `/organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/status/stream` | [`streamRunStatus`](../apps/api/src/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.controller.ts#L311) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/file/:documentId/columns` | [`getFileColumns`](../apps/api/src/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.controller.ts#L328) |

## domains/agents/extraction-agent-sessions/extraction-agent-sessions.controller.ts

6 of 8 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET (SSE) | `/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/status/stream` | [`streamSessionStatus`](../apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-sessions.controller.ts#L147) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions` | [`getAll`](../apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-sessions.controller.ts#L163) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/:agentSessionId/getOne` | [`getOne`](../apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-sessions.controller.ts#L179) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/:agentSessionId/delete` | [`deleteOne`](../apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-sessions.controller.ts#L190) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/documents/presign` | [`presignDocument`](../apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-sessions.controller.ts#L208) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/documents/mine` | [`listMyDocuments`](../apps/api/src/domains/agents/extraction-agent-sessions/extraction-agent-sessions.controller.ts#L253) |

## domains/agents/memberships/agent-memberships.controller.ts

1 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/memberships` | [`getAll`](../apps/api/src/domains/agents/memberships/agent-memberships.controller.ts#L28) |

## domains/agents/settings/agent-settings.controller.ts

2 of 6 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/settings` | [`getAll`](../apps/api/src/domains/agents/settings/agent-settings.controller.ts#L41) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/output-json-schema` | [`getFillFormOutputJsonSchema`](../apps/api/src/domains/agents/settings/agent-settings.controller.ts#L66) |

## domains/agents/shared/agent-session-messages/agent-messages.controller.ts

5 of 5 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/messages` | [`getAll`](../apps/api/src/domains/agents/shared/agent-session-messages/agent-messages.controller.ts#L59) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/messages/mcp-app-html` | [`getMcpAppHtml`](../apps/api/src/domains/agents/shared/agent-session-messages/agent-messages.controller.ts#L75) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/messages/:messageId` | [`getOne`](../apps/api/src/domains/agents/shared/agent-session-messages/agent-messages.controller.ts#L103) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/messages/attachment-document/presign` | [`presignAttachmentDocument`](../apps/api/src/domains/agents/shared/agent-session-messages/agent-messages.controller.ts#L123) |
| POST | `/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/messages/attachment-document/:attachmentDocumentId/temporary-url` | [`getAttachmentDocumentTemporaryUrl`](../apps/api/src/domains/agents/shared/agent-session-messages/agent-messages.controller.ts#L174) |

## domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/agent-messages/:agentMessageId/feedbacks` | [`createOne`](../apps/api/src/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.controller.ts#L31) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/feedbacks` | [`getAll`](../apps/api/src/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.controller.ts#L52) |

## domains/agents/shared/agent-session-messages/streaming/streaming.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET (SSE) | `/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/stream` | [`stream`](../apps/api/src/domains/agents/shared/agent-session-messages/streaming/streaming.controller.ts#L46) |

## domains/analytics/agents-analytics/agents-analytics.controller.ts

3 of 3 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/analytics/conversations-per-day` | [`getConversationsPerDay`](../apps/api/src/domains/analytics/agents-analytics/agents-analytics.controller.ts#L29) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/analytics/avg-user-questions-per-session-per-day` | [`getAvgUserQuestionsPerSessionPerDay`](../apps/api/src/domains/analytics/agents-analytics/agents-analytics.controller.ts#L47) |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/analytics/conversations-by-category-per-day` | [`getConversationsByCategoryPerDay`](../apps/api/src/domains/analytics/agents-analytics/agents-analytics.controller.ts#L65) |

## domains/analytics/projects-analytics/projects-analytics.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/analytics/conversations-per-day` | [`getConversationsPerDay`](../apps/api/src/domains/analytics/projects-analytics/projects-analytics.controller.ts#L40) |
| GET | `/organizations/:organizationId/projects/:projectId/analytics/avg-user-questions-per-session-per-day` | [`getAvgUserQuestionsPerSessionPerDay`](../apps/api/src/domains/analytics/projects-analytics/projects-analytics.controller.ts#L60) |

## domains/apps/apps-install.controller.ts

4 of 4 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/apps/install/:slug` | [`getInstall`](../apps/api/src/domains/apps/apps-install.controller.ts#L35) |
| POST | `/apps/install/:slug/authorize` | [`authorize`](../apps/api/src/domains/apps/apps-install.controller.ts#L45) |
| GET | `/projects/:projectId/app-installations` | [`listForProject`](../apps/api/src/domains/apps/apps-install.controller.ts#L64) |
| POST | `/app-installations/:id/revoke` | [`revoke`](../apps/api/src/domains/apps/apps-install.controller.ts#L73) |

## domains/apps/apps-v1.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/apps/v1/token` | [`createToken`](../apps/api/src/domains/apps/apps-v1.controller.ts#L12) |
| GET | `/apps/v1/me` | [`getMe`](../apps/api/src/domains/apps/apps-v1.controller.ts#L23) |

## domains/apps/apps.controller.ts

5 of 5 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/backoffice/apps` | [`getAll`](../apps/api/src/domains/apps/apps.controller.ts#L23) |
| GET | `/backoffice/apps/:appManifestId` | [`getOne`](../apps/api/src/domains/apps/apps.controller.ts#L30) |
| POST | `/backoffice/apps` | [`createOne`](../apps/api/src/domains/apps/apps.controller.ts#L39) |
| PATCH | `/backoffice/apps/:appManifestId` | [`updateOne`](../apps/api/src/domains/apps/apps.controller.ts#L54) |
| DELETE | `/backoffice/apps/:appManifestId` | [`deleteOne`](../apps/api/src/domains/apps/apps.controller.ts#L64) |

## domains/apps/document-sources/apps-document-sources.controller.ts

5 of 5 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/apps/v1/projects/:projectId/document-sources` | [`getAll`](../apps/api/src/domains/apps/document-sources/apps-document-sources.controller.ts#L48) |
| GET | `/apps/v1/projects/:projectId/document-sources/:id` | [`getOne`](../apps/api/src/domains/apps/document-sources/apps-document-sources.controller.ts#L62) |
| POST | `/apps/v1/projects/:projectId/document-sources` | [`createOne`](../apps/api/src/domains/apps/document-sources/apps-document-sources.controller.ts#L77) |
| PATCH | `/apps/v1/projects/:projectId/document-sources/:id` | [`updateOne`](../apps/api/src/domains/apps/document-sources/apps-document-sources.controller.ts#L101) |
| DELETE | `/apps/v1/projects/:projectId/document-sources/:id` | [`deleteOne`](../apps/api/src/domains/apps/document-sources/apps-document-sources.controller.ts#L122) |

## domains/apps/documents/apps-documents.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/apps/v1/projects/:projectId/documents` | [`createOne`](../apps/api/src/domains/apps/documents/apps-documents.controller.ts#L42) |
| POST | `/apps/v1/projects/:projectId/documents/:documentId/confirm` | [`confirmOne`](../apps/api/src/domains/apps/documents/apps-documents.controller.ts#L89) |

## domains/backoffice/backoffice.controller.ts

9 of 12 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/backoffice/organizations` | [`listOrganizations`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L63) |
| GET | `/backoffice/organizations/:organizationId` | [`getOrganization`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L89) |
| GET | `/backoffice/agents` | [`listAgents`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L103) |
| GET | `/backoffice/agents/:agentId` | [`getAgent`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L129) |
| GET | `/backoffice/users` | [`listUsers`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L141) |
| GET | `/backoffice/users/:userId` | [`getUser`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L167) |
| GET | `/backoffice/rbac/catalog` | [`getRbacCatalog`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L191) |
| GET | `/backoffice/projects` | [`listProjects`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L197) |
| GET | `/backoffice/projects/:projectId` | [`getProject`](../apps/api/src/domains/backoffice/backoffice.controller.ts#L223) |

## domains/documents/crawling/crawling.controller.ts

2 of 4 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/documents/:documentId/cancel-crawl` | [`cancelCrawl`](../apps/api/src/domains/documents/crawling/crawling.controller.ts#L157) |
| GET (SSE) | `/organizations/:organizationId/projects/:projectId/documents/crawl-progress/stream` | [`streamCrawlProgress`](../apps/api/src/domains/documents/crawling/crawling.controller.ts#L187) |

## domains/documents/documents.controller.ts

6 of 9 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/documents/:sourceType/presign` | [`presignMany`](../apps/api/src/domains/documents/documents.controller.ts#L64) |
| POST | `/organizations/:organizationId/projects/:projectId/documents/:documentId/reprocess` | [`reprocessOne`](../apps/api/src/domains/documents/documents.controller.ts#L150) |
| GET | `/organizations/:organizationId/projects/:projectId/documents/:sourceType` | [`getAll`](../apps/api/src/domains/documents/documents.controller.ts#L177) |
| GET | `/organizations/:organizationId/projects/:projectId/documents/:documentId/temporary-url` | [`getTemporaryUrl`](../apps/api/src/domains/documents/documents.controller.ts#L227) |
| GET | `/organizations/:organizationId/projects/:projectId/documents/:documentId/is-public` | [`getIsPublic`](../apps/api/src/domains/documents/documents.controller.ts#L246) |
| GET (SSE) | `/organizations/:organizationId/projects/:projectId/documents/embedding-status/stream` | [`streamEmbeddingStatus`](../apps/api/src/domains/documents/documents.controller.ts#L255) |

## domains/documents/storage/local-presign-upload.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| PUT | `/local-presign-upload/:token` | [`upload`](../apps/api/src/domains/documents/storage/local-presign-upload.controller.ts#L21) |

## domains/documents/tags/document-tags.controller.ts

1 of 4 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/document-tags` | [`getAll`](../apps/api/src/domains/documents/tags/document-tags.controller.ts#L43) |

## domains/evaluations/conversation/datasets/evaluation-conversation-datasets.controller.ts

2 of 9 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-conversation-datasets` | [`getAll`](../apps/api/src/domains/evaluations/conversation/datasets/evaluation-conversation-datasets.controller.ts#L44) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-conversation-datasets/:datasetId/records` | [`getRecords`](../apps/api/src/domains/evaluations/conversation/datasets/evaluation-conversation-datasets.controller.ts#L64) |

## domains/evaluations/conversation/runs/evaluation-conversation-runs.controller.ts

4 of 9 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-conversation-runs/:evaluationConversationRunId` | [`getOne`](../apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-runs.controller.ts#L200) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-conversation-runs` | [`getAll`](../apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-runs.controller.ts#L209) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-conversation-runs/:evaluationConversationRunId/records` | [`getRecords`](../apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-runs.controller.ts#L220) |
| GET (SSE) | `/organizations/:organizationId/projects/:projectId/evaluation-conversation-runs/status/stream` | [`streamRunStatus`](../apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-runs.controller.ts#L262) |

## domains/evaluations/extraction/datasets/evaluation-extraction-datasets.controller.ts

5 of 11 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-datasets/files` | [`getAllFiles`](../apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-datasets.controller.ts#L62) |
| POST | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-datasets/files/presign` | [`presignFile`](../apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-datasets.controller.ts#L73) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-datasets/files/:documentId/columns` | [`getColumns`](../apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-datasets.controller.ts#L102) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-datasets` | [`getAll`](../apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-datasets.controller.ts#L134) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-datasets/:datasetId/records` | [`getRecords`](../apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-datasets.controller.ts#L154) |

## domains/evaluations/extraction/runs/evaluation-extraction-runs.controller.ts

4 of 9 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-runs/:evaluationExtractionRunId` | [`getOne`](../apps/api/src/domains/evaluations/extraction/runs/evaluation-extraction-runs.controller.ts#L208) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-runs` | [`getAll`](../apps/api/src/domains/evaluations/extraction/runs/evaluation-extraction-runs.controller.ts#L217) |
| GET | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-runs/:evaluationExtractionRunId/records` | [`getRecords`](../apps/api/src/domains/evaluations/extraction/runs/evaluation-extraction-runs.controller.ts#L228) |
| GET (SSE) | `/organizations/:organizationId/projects/:projectId/evaluation-extraction-runs/status/stream` | [`streamRunStatus`](../apps/api/src/domains/evaluations/extraction/runs/evaluation-extraction-runs.controller.ts#L286) |

## domains/invitations/invitations.controller.ts

2 of 5 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/invitations/mine` | [`listPendingMine`](../apps/api/src/domains/invitations/invitations.controller.ts#L92) |
| GET | `/invitations` | [`listForTarget`](../apps/api/src/domains/invitations/invitations.controller.ts#L104) |

## domains/mcp-servers/mcp-servers.controller.ts

7 of 7 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/mcp-servers` | [`createOne`](../apps/api/src/domains/mcp-servers/mcp-servers.controller.ts#L40) |
| GET | `/organizations/:organizationId/projects/:projectId/mcp-servers` | [`getAll`](../apps/api/src/domains/mcp-servers/mcp-servers.controller.ts#L65) |
| DELETE | `/organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId` | [`deleteOne`](../apps/api/src/domains/mcp-servers/mcp-servers.controller.ts#L79) |
| POST | `/organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/agents/:agentId` | [`enableForAgent`](../apps/api/src/domains/mcp-servers/mcp-servers.controller.ts#L92) |
| DELETE | `/organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/agents/:agentId` | [`disableForAgent`](../apps/api/src/domains/mcp-servers/mcp-servers.controller.ts#L102) |
| POST | `/organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/oauth/initiate` | [`initiateOauth`](../apps/api/src/domains/mcp-servers/mcp-servers.controller.ts#L114) |
| POST | `/organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/oauth/complete` | [`completeOauth`](../apps/api/src/domains/mcp-servers/mcp-servers.controller.ts#L124) |

## domains/me/me.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| PATCH | `/me` | [`patchMe`](../apps/api/src/domains/me/me.controller.ts#L35) |
| GET | `/me` | [`getMe`](../apps/api/src/domains/me/me.controller.ts#L46) |

## domains/organizations/organizations.controller.ts

2 of 3 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/mine` | [`listOrganizations`](../apps/api/src/domains/organizations/organizations.controller.ts#L22) |
| PATCH | `/organizations/:organizationId` | [`updateOrganization`](../apps/api/src/domains/organizations/organizations.controller.ts#L47) |

## domains/projects/memberships/project-memberships.controller.ts

2 of 3 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/memberships` | [`getAll`](../apps/api/src/domains/projects/memberships/project-memberships.controller.ts#L28) |
| GET | `/organizations/:organizationId/projects/:projectId/memberships/:membershipId/agents` | [`getMemberAgents`](../apps/api/src/domains/projects/memberships/project-memberships.controller.ts#L40) |

## domains/projects/projects.controller.ts

2 of 5 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/projects/mine` | [`listUserProjects`](../apps/api/src/domains/projects/projects.controller.ts#L34) |
| GET | `/organizations/:organizationId/projects` | [`listProjects`](../apps/api/src/domains/projects/projects.controller.ts#L61) |

## domains/public-chat/agent-embed-configs/agent-embed-configs-management.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/agents/:agentId/embed-config` | [`getOne`](../apps/api/src/domains/public-chat/agent-embed-configs/agent-embed-configs-management.controller.ts#L21) |
| PATCH | `/organizations/:organizationId/projects/:projectId/agents/:agentId/embed-config` | [`updateOne`](../apps/api/src/domains/public-chat/agent-embed-configs/agent-embed-configs-management.controller.ts#L36) |

## domains/public-chat/legacy/public-chat-legacy.controller.ts

4 of 4 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/public/agents/:embedToken/config` | [`getConfig`](../apps/api/src/domains/public-chat/legacy/public-chat-legacy.controller.ts#L41) |
| POST | `/public/agents/:embedToken/sessions` | [`createSession`](../apps/api/src/domains/public-chat/legacy/public-chat-legacy.controller.ts#L46) |
| GET | `/public/agents/:embedToken/sessions/:sessionId` | [`getSession`](../apps/api/src/domains/public-chat/legacy/public-chat-legacy.controller.ts#L58) |
| GET (SSE) | `/public/agents/:embedToken/sessions/:sessionId/messages/stream` | [`streamMessages`](../apps/api/src/domains/public-chat/legacy/public-chat-legacy.controller.ts#L73) |

## domains/public-chat/v1/public-chat-v1.controller.ts

5 of 5 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/public/v1/agents/:embedToken/config` | [`getConfig`](../apps/api/src/domains/public-chat/v1/public-chat-v1.controller.ts#L47) |
| POST | `/public/v1/agents/:embedToken/sessions` | [`createSession`](../apps/api/src/domains/public-chat/v1/public-chat-v1.controller.ts#L52) |
| GET | `/public/v1/agents/:embedToken/sessions/:sessionId` | [`getSession`](../apps/api/src/domains/public-chat/v1/public-chat-v1.controller.ts#L64) |
| GET | `/public/v1/agents/:embedToken/sessions/:sessionId/mcp-app-html` | [`getMcpAppHtml`](../apps/api/src/domains/public-chat/v1/public-chat-v1.controller.ts#L73) |
| GET (SSE) | `/public/v1/agents/:embedToken/sessions/:sessionId/messages/stream` | [`streamMessages`](../apps/api/src/domains/public-chat/v1/public-chat-v1.controller.ts#L82) |

## domains/resource-libraries/resource-libraries.controller.ts

2 of 8 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/resource-libraries` | [`getAll`](../apps/api/src/domains/resource-libraries/resource-libraries.controller.ts#L88) |
| POST | `/organizations/:organizationId/projects/:projectId/resource-libraries/files/upload` | [`uploadResourceFile`](../apps/api/src/domains/resource-libraries/resource-libraries.controller.ts#L183) |

## domains/resource-libraries/resource-library-files.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/resource-libraries/:resourceLibraryId/resources/:resourceId/file` | [`downloadResourceFile`](../apps/api/src/domains/resource-libraries/resource-library-files.controller.ts#L24) |

## domains/review-campaigns/reports/reports.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/report` | [`getCampaignReport`](../apps/api/src/domains/review-campaigns/reports/reports.controller.ts#L24) |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/report.csv` | [`getCampaignReportCsv`](../apps/api/src/domains/review-campaigns/reports/reports.controller.ts#L32) |

## domains/review-campaigns/review-campaigns.controller.ts

6 of 6 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/review-campaigns` | [`createOne`](../apps/api/src/domains/review-campaigns/review-campaigns.controller.ts#L31) |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns` | [`getAll`](../apps/api/src/domains/review-campaigns/review-campaigns.controller.ts#L44) |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId` | [`getOne`](../apps/api/src/domains/review-campaigns/review-campaigns.controller.ts#L60) |
| PATCH | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId` | [`updateOne`](../apps/api/src/domains/review-campaigns/review-campaigns.controller.ts#L73) |
| DELETE | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId` | [`deleteOne`](../apps/api/src/domains/review-campaigns/review-campaigns.controller.ts#L88) |
| DELETE | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/memberships/:membershipId` | [`revokeMembership`](../apps/api/src/domains/review-campaigns/review-campaigns.controller.ts#L101) |

## domains/review-campaigns/reviewer/reviewer-session-detail.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/agent-sessions/:sessionId/reviewer-view` | [`getReviewerSession`](../apps/api/src/domains/review-campaigns/reviewer/reviewer-session-detail.controller.ts#L32) |

## domains/review-campaigns/reviewer/reviewer-sessions.controller.ts

1 of 1 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/reviewer-sessions` | [`listReviewerSessions`](../apps/api/src/domains/review-campaigns/reviewer/reviewer-sessions.controller.ts#L23) |

## domains/review-campaigns/reviewer/reviewer.controller.ts

2 of 2 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/agent-sessions/:sessionId/reviewer-reviews` | [`submitReviewerSessionReview`](../apps/api/src/domains/review-campaigns/reviewer/reviewer.controller.ts#L24) |
| PATCH | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/agent-sessions/:sessionId/reviewer-reviews/:reviewId` | [`updateReviewerSessionReview`](../apps/api/src/domains/review-campaigns/reviewer/reviewer.controller.ts#L44) |

## domains/review-campaigns/tester/tester.controller.ts

10 of 10 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/me/review-campaigns` | [`getMyReviewCampaigns`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L49) |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/tester-context` | [`getTesterContext`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L72) |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/my-tester-sessions` | [`listMyTesterSessions`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L84) |
| POST | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/agent-sessions` | [`startTesterSession`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L97) |
| POST | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/tester-survey` | [`submitTesterSurvey`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L112) |
| PATCH | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/tester-survey` | [`updateTesterSurvey`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L127) |
| GET | `/organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/tester-survey` | [`getMyTesterSurvey`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L141) |
| POST | `/organizations/:organizationId/projects/:projectId/agent-sessions/:sessionId/tester-feedback` | [`submitTesterFeedback`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L160) |
| PATCH | `/organizations/:organizationId/projects/:projectId/agent-sessions/:sessionId/tester-feedback` | [`updateTesterFeedback`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L180) |
| DELETE | `/organizations/:organizationId/projects/:projectId/agent-sessions/:sessionId/tester-session` | [`deleteTesterSession`](../apps/api/src/domains/review-campaigns/tester/tester.controller.ts#L197) |

## domains/terms-compliance/terms-compliance.controller.ts

3 of 3 endpoints untracked.

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/me/terms-acceptances` | [`acceptTerms`](../apps/api/src/domains/terms-compliance/terms-compliance.controller.ts#L18) |
| GET | `/backoffice/terms-documents` | [`listTermsDocuments`](../apps/api/src/domains/terms-compliance/terms-compliance.controller.ts#L31) |
| PUT | `/backoffice/terms-documents` | [`updateTermsDocuments`](../apps/api/src/domains/terms-compliance/terms-compliance.controller.ts#L40) |
