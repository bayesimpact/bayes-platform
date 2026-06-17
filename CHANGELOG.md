# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [CalVer](https://calver.org/) (YY.MM.Micro) for product versioning.

## [Unreleased]

### Added
- Resource libraries: create and manage libraries of resources (files and links) in the Studio, then attach them to agents so the resources are injected into the agent's prompt
- Agents can surface resources from their attached libraries directly in the chat, displaying them as cards to the user
- Resource files can be downloaded from the chat

### Changed
- Agent creation is now a single dialog where you pick the agent type and name, replacing the previous multi-step flow
- Document search (RAG) mode descriptions have been rewritten in plain, user-friendly language
- Source tag badges on the agent Sources tab now show tooltips describing each tag
- The "public-documents" tag now displays an in-app description explaining that its sources can be downloaded from the chat
- The web sources page now has a dedicated title and description
- Records left running when an extraction run is cancelled now show a distinct "Cancelled" status instead of being marked as errors

### Fixed

### Security

## [26.06.3] - 2026-06-16

### Added
- Sources tagged "public-documents" can be downloaded from the chat sources panel

### Changed

### Fixed

### Security

## [26.06.2] - 2026-06-12

### Added

### Changed
- Extraction records are processed in parallel, speeding up runs
- Cancelling an extraction run is now faster, especially for large runs.

### Fixed
- Reviewers can now reopen completed review campaigns from the Reviewer app and consult sessions, reviews, and reports in read-only mode

### Security

## [26.06.1] - 2026-06-12

### Added
- Exctraction agent can handle CSV file
- Embed widget display mode: configure each agent's chat widget to appear as a floating bubble (modal, default) or a side drawer, set per embed config from the Studio
- In-platform help chat: a chat lets users ask questions about the platform directly from within the app

### Changed
- Workers can run as separate CPU and GPU pools: each worker instance now selects which queues it consumes via the required `WORKER_QUEUE_NAMES` env var (fails fast if unset or unknown), instead of every instance consuming all queues
- Workers ship as two Docker images — a CPU image (no Docling) and a GPU image (Docling/Torch included) — built from the `cpu-workers-runtime` and `gpu-workers-runtime` targets

### Fixed
- Chat responses no longer display partially or crash the app when the browser's auto-translate feature is active
- Agent Sources tab now reacts correctly to RAG mode changes
- The "Tags" rag mode option is now hidden in the dropdown when the project has no document tags
- Tester review-campaign sessions now show the actual submitted result for form-based agents instead of an empty placeholder, and the session list refreshes automatically when a form is submitted
- Testers no longer get stuck on an endless loading screen after starting or opening a session in a review campaign

### Security

## [26.06.0] - 2026-06-04

### Added
- Organization owners and admins can now rename their organization directly from the onboarding page
- Workspace administration page (general settings + agent categories management)
- Manage agent categories per workspace directly from the Studio (add / delete)
- Evaluation extraction runs can be scoped to a subset of dataset records: choose to run against the entire dataset or a specific number of records (1 to N)
- Evaluation extraction datasets can be renamed after creation via a dialog
- Evaluation extraction run detail page has a "View Agent" button showing the agent's model, temperature, language, document search mode, system prompt, and output schema
- Evaluation extraction runs can be deleted from the run history
- Evaluation extraction datasets can be deleted from the dataset list
- Evaluation extraction run detail page shows how long a finished run took
- Users can now edit their display name from the user menu

### Changed
- Evaluation extraction dataset column roles can be assigned in bulk: select multiple columns and apply a role (target / input / reference / ignore) to all of them at once
- Evaluation extraction run CSV results are available for download even when the run is cancelled
- Workspace name can be edited from the new Admin page instead of a dialog in the header
- Agent categories management moved from the Backoffice to the workspace Admin page
- New agents have all project categories pre-selected by default
- Evaluation extraction run records are indexed by run and status, speeding up queries for large runs

### Fixed
- Importing large evaluation extraction datasets no longer times out: records are now inserted in bulk instead of one row at a time
- Agent deletion reliably soft-deletes all related records within the transaction
- Project deletion reliably soft-deletes all related records within the transaction

### Security

## [26.05.3] - 2026-05-29

### Added
- (beta) Agent orchestration: configure conversation agents with sub-agents and delegate runtime tasks to them as tools

### Changed

### Fixed
- Allow entering commas in comma-separated form fields
- Remove Gemma 4 thought tokens

### Security

## [26.05.2] - 2026-05-27

### Added
- Display evaluation extraction run metrics in Bull Board
- Retry failed evaluation extraction runs from the UI
- Require users to accept General Conditions of Service and Privacy Policy before accessing the app
- Manage General Conditions of Service and Privacy Policy from the Backoffice
- (beta) Medgemma 1.0 available for all Agents
- (beta) Gemma 4 available for all Agents
- (beta) Web sources crawling
- (beta) Embed a conversation agent as a chat widget on any external website

### Changed

### Fixed
- Recover stuck evaluation extraction worker jobs after rebooting
- Langfuse trace
- Paginate user list in Backoffice
- Paginate organization list in Backoffice

### Security

## [26.05.1] - 2026-05-05

### Added
- Allow to reprocess documents after a timeout

### Changed

### Fixed
- Hide FYI column in evaluation matching

### Security

## [26.05.0] - 2026-05-04

### Added
- Conversation and form agents can now send an optional greeting as the first message of a new session
- Link to Help Center
- Track user activities for further auditing
- Define agent document RAG modes — off, all, or tagged
- Add tag selection before document upload (single and batch)
- Bull board UI for queue monitoring
- Copy chat messages to clipboard
- Warn before closing or refreshing the tab during document uploads
- List pending invitations
- Add a backoffice
- (beta) Display analytics per agent (sessions per day)
- (beta) Medgemma available for Conversational Agent
- (beta) Agents can connect to external MCP servers for additional tools
- (beta) Evaluate extraction agents against datasets
- (beta) Project-level agent categories and category analytics
- (beta) Review campaigns: invite testers and reviewers to evaluate an agent with structured feedback, blind reviews, factual question marking, and aggregate reporting with CSV export

### Changed
- Agent configuration is now organized into tabs (General, Model, Sources, and Form or Output) for easier editing
- New user interface to list organizations, workspaces, agents, sessions
- Unified observability: structured logging, request tracing, error alerting, and queue health monitoring via GCP
- Only list sessions belonging to the selected agent
- Expand document upload dropzone to cover the entire page

### Fixed
- Form result panel now scrolls when it has more fields than fit on screen
- Restricted access to Studio mode for non-admin users

### Security

## [26.04.2] - 2026-04-08

### Added

### Changed

### Fixed
- Form agent messages were sent to the LLM in wrong order, causing incoherent conversations when filling form fields

### Security

## [26.04.1] - 2026-04-03

### Added
- (beta) Analytics

### Changed

### Fixed
- Bad agent session listing (avoid 404 errors on some agent sessions)

### Security

## [26.04.0] - 2026-04-01

### Added
- Agent sessions can be deleted

### Changed
- Expanded RAG document MIME support to include Word, Excel, PowerPoint, and additional image formats (TIFF, BMP, WebP), alongside PDF/CSV/plain text.

### Fixed

### Security
- Update dependencies to address security vulnerabilities

## [26.03.1] - 2026-03-27

### Added
- In-app invitations: invite and remove users from agents and projects with role-based access
- Role-based authorization: define rights levels between users and admins across organizations, projects, and agents
- New navigation UI with breadcrumbs, organization/project selector, and agent member management
- Multi-file upload: upload up to 400 files at once with progress indicators
- Default prompt and schema for new agents
- Agent-scoped document tag filtering for conversations
- Document processing with Docling for extracting content from PDFs and other file formats
- (beta) Medgemma available for Extraction Agent
- (beta) Sources tool: display document sources used by the AI directly in chat messages

### Changed
- Renamed "Project" to "Workspace" across the application

### Fixed
- Race condition causing infinite streaming status
- Scroll issue in feedback modal

### Security
- Added Trivy vulnerability scanning for API and workers Docker images
- Added Gitleaks workflow for secret detection in commits

## [26.03.0] - 2026-03-13

First public release of Bayes Platform, open-sourced under the MIT license.

### Added
- AI agents: create conversation and extraction agents with configurable prompts, models, and JSON schemas
- Agent sessions: chat with AI agents, with real-time SSE streaming and tool message display
- Form-filling agents: LLM-powered form completion with side panel UI
- Document management: upload, tag, and organize documents per project
- RAG pipeline: PDF embedding generation, storage, and LLM tool to query embeddings with tag-based filtering
- Document embedding status: display processing state of uploaded documents
- Agent feedback: collect and review user feedback on agent messages
- File attachments: upload PDFs and images as chat messages for AI analysis
- Dictaphone: voice input for agent conversations
- Multi-tenant architecture: organizations, projects, and membership-based access control
- User onboarding: smoother first-time setup with automatic organization creation
- CLI for user/org import: bulk import users and organizations from CSV
- Async job processing: BullMQ-based worker system for background tasks (document processing, embeddings)
- Observability: Langfuse tracing integration for agent sessions
- Internationalization: English and French support with automatic locale discovery
- Theming: configurable color themes (coral, blue) with environment variable support and dynamic favicon
- Studio mode: admin interface renamed from "admin" with nav menu switch
- GCP deployment: full production pipeline with Cloud Run, Cloud SQL, and GCS storage
- Open-source release: MIT license, README, and GCP installation guide
- (beta) Evaluation system: create evaluations with LLM-generated reports

### Fixed
- Missing embedding models in production
- Workers not correctly launched in production
- Onboarding redirect when no project exists
