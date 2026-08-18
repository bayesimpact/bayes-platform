## Code review — Docling/Playwright crawler engine

Reviewed at max depth: ten finder passes over the diff plus a 13-agent adversarial verification pass, each finding traced end-to-end against the PR head. **All 19 verified claims were confirmed; none refuted.** Findings are grouped by severity, each with a suggested fix.

The overarching theme: as written, the engine **cannot succeed in a deployed environment**, and where it does run it tends to fail **silently** (documents marked "completed"/"pending" rather than "failed"). Most of the operational gaps trace back to one root cause — the engine was added as a *parallel vertical* (a full copy of the url-crawling stack) rather than as a strategy behind the existing crawl pipeline, so cross-cutting behaviour (cancel routing, recrawl, metrics) silently diverged.

> **Status note (2026-08-18):** the repo was checked out at commit `b5b059ac` ("fail fast when DOCLING_SERVE_URL is unset") after a rollback, then Spider.cloud was removed entirely (uncommitted, this session) — Docling is now the only crawl engine; see #16/#17 below, both resolved as a side effect. #4 (SSRF) and #5 (silent failures) have since been re-fixed on top of that baseline. #7 (engine persistence) was never committed and is gone entirely (moot now that there's only one engine). #6 (cancel doesn't stop an already-running docling job / cancel-then-recrawl race) was deliberately deferred — deemed lower priority for now. #8 (worker stall leaves docs stuck `pending`) has since been fixed. #9 (unbounded crawl) is partially fixed — wall-clock deadline added only (no page cap, by deliberate choice; depth-limit and streaming storage deferred). #10 (browser leak on early failure) has since been fixed. #11–#15 (dedup/scoping/extension-filter/empty-page bugs in the link-discovery block) have since been fixed together in one pass. #18 (quadratic queue lookup) and #19 (serial goto/convert) have since been fixed together, as they live in the same loop. #20 (O(queue) cancel scan) has since been fixed. #21 (untested dl→ul rewrite) has since been fixed. 19/27 fully fixed so far (#1–#5, #8, #10, #11–#21), plus #9 partial.

---

### 🔴 Blockers — the engine can't work once deployed

1. ✅ **FIXED** — **No runtime image installs Playwright Chromium** — `apps/api/Dockerfile`
   `playwright@1.62.0` ships no browser-download install script, and no build stage runs `npx playwright install chromium` or installs Chromium's OS libs (libnss3/libatk/libgbm/libasound2…). `npm ci` downloads no browser. Result: `chromium.launch()` throws *"Executable doesn't exist"* in every deployed container and every docling crawl job fails.
   **Fix applied:** `apps/api/Dockerfile:72` runs `npx --prefix /app/apps/api playwright install --with-deps chromium` in the cpu-workers-runtime stage.

2. ✅ **FIXED** — **`WORKER_QUEUE_NAMES` templates never list `docling-crawling`** — `apps/api/.env-example:75`, `infra/docker-compose.api-workers-smoke.yaml`, `apps/api/jest.setup-early.ts`
   `docling-crawling` was added to `KNOWN_WORKER_QUEUE_NAMES`/the module registry but not to any allowlist template. `workers-app.module.ts` only loads `DoclingCrawlingWorkersModule` when the queue is listed. The endpoint has no feature gate, so the user picks "Docling", gets a 202 + success toast, the document is created `embeddingStatus: 'pending'`, and the job sits unconsumed in Redis forever.
   **Fix applied:** `docling-crawling` added to the `WORKER_QUEUE_NAMES` value in all templates.

3. ✅ **FIXED** — **`DOCLING_SERVE_URL` silently defaults to `http://localhost:5001`** — `apps/api/src/external/docling-crawler/docling-crawler.constants.ts`
   Only the local compose stack provisions docling-serve; smoke/deploy configs point nowhere. Unlike `resolveSpiderApiKey` (which throws when unset), a misconfigured deploy just failed every `convert` call — and because those errors are swallowed (see #5), it yielded silently-empty "completed" documents.
   **Fix applied:** `resolveDoclingServeUrl` now throws when unset instead of defaulting.

---

### 🔴 Security

4. ✅ **FIXED** — **SSRF / local-file disclosure** — `apps/api/src/domains/documents/crawling/crawling.controller.ts`
   `crawlUrlDocling` validated the target only with `new URL(payload.url)` — no scheme allowlist, no private-host/IP restriction. `new URL()` accepts `file:///etc/passwd`, `http://169.254.169.254/` (cloud metadata), `http://internal-host:6379/`. Since Docling navigates it with **Chromium running inside the worker container** and stores/embeds the result, any authenticated project member with document-create permission could read local files or reach internal services.
   **Fix applied:** Added `apps/api/src/common/utils/crawl-url-safety.ts` (`assertCrawlUrlIsSafe`/`assertIpIsSafe`, using `ipaddr.js` to allowlist only `unicast` addresses — default-deny everything else: private/loopback/link-local/reserved/etc.). Called from `crawlUrlDocling` before enqueueing, and from `DoclingCrawlerClientService.crawlUrl` before every `page.goto()` (covers the start URL and every discovered link) plus after navigation via `response.serverAddr()` (defeats DNS rebinding and redirects to a private host). A safety violation aborts the whole crawl rather than being swallowed as a per-page error.

---

### 🟠 Silent-failure & correctness

5. ✅ **FIXED** — **Swallowed crawl errors → stored as a successful, empty document** — `docling-crawler-client.service.ts` → `docling-crawling-processor.service.ts`
   The per-page `catch` swallowed all `goto`/`convert` failures (`errored++; continue`), so a fully-failed crawl (docling-serve down, DNS failure on the start URL) resolved with `pages=[]`. The processor had no zero-pages guard, stored `'[]'`, enqueued embeddings, and the pipeline marked the doc `completed`. Bonus bug: link-enqueue ran *after* `convert` in the same `try`, so a convert failure on the start page discarded its links and ended the whole crawl at zero pages.
   **Fix applied:** `docling-crawler-client.service.ts` now rethrows (instead of swallowing) on `UnsafeCrawlUrlError`, docling-serve connection errors (`ECONNREFUSED`), or a total loss of the start page (before its links were even enqueued); a `pages.length === 0 && errored > 0` backstop at the end of the loop. Link discovery/enqueue was moved before the `convert()` call so a page's links survive a conversion failure on that page. `docling-crawling-processor.service.ts` also gained an independent `pages.length === 0` guard, flowing into the existing failure-handling path (marks doc `failed`, notifies, rethrows).

6. 🟡 **PARTIALLY FIXED (side effect of Spider removal)** — **Cancel never cancels docling jobs; cancel-then-recrawl race** — `crawling.controller.ts`
   Originally: `cancelCrawl` only purged the spider queue — `BullMqDoclingCrawlingBatchService.cancelCrawlUrl` had **zero callers** (dead code), since it was never wired up correctly. Now that Spider is removed and `doclingCrawlingBatchService` is the only batch service, `cancelCrawl` unconditionally calls `doclingCrawlingBatchService.cancelCrawlUrl` — the wrong-engine/dead-code part of this finding is resolved by construction. **Still open:** a cancelled docling crawl still runs the full (unbounded) Playwright crawl to completion before its only guard (a post-crawl `embeddingStatus === 'failed'` check) discards it — cancel only removes the job if it's still *queued*, not already running. Worse: if the user cancels then recrawls, `resetForRecrawl` sets status back to `pending`, so the stale job's guard passes, `updateContent` overwrites the fresh crawl's content, and a duplicate embeddings run is enqueued.
   **Fix:** Add a mid-crawl cancellation checkpoint in the crawler's loop (re-check document status or a cancel flag each iteration) so an already-running crawl stops instead of finishing. Fix the race by tagging each crawl job with a token (e.g. a persisted `activeCrawlJobToken`, generated fresh per enqueue) and only letting the processor write content if the document still expects *that* job — a stale/superseded job then no-ops instead of overwriting fresher content.

7. **Recrawl always switches to spider; engine not persisted** — `crawling.controller.ts:195`
   `reCrawlUrl` always enqueues on the spider queue, and both payloads set `extractionEngine` to the same literal `'web-crawl'`, so docling docs are indistinguishable. Recrawling a docling doc silently swaps engines (docling's origin+base-path scoping → spider's whole-site `limit:0`), and in a docling-only deploy without `SPIDER_API_KEY` the worker throws *after* `resetForRecrawl` already wiped the doc, flipping it to `failed`.
   **Fix:** Persist the crawl engine on the Document (reuse the existing `extraction_engine` column or add a dedicated `crawlEngine`), set it in both `crawlUrl` and `crawlUrlDocling`, and have `reCrawlUrl` read it to enqueue on the matching queue. This single change also gives `cancelCrawl` (#6) the data it needs to route correctly.

8. ✅ **FIXED** — **Worker stall leaves the document stuck `pending` forever** — `docling-crawling.worker.ts`
   `@Processor` with no options (concurrency 1, lockDuration 30s, maxStalledCount 1). A worker killed mid-crawl (deploy) stalled the job; after the stall limit BullMQ moved it to failed via the deferred path *without re-entering `process()`*, so the processor's `catch` (which would set `failed`) never ran. `@OnWorkerEvent('failed')` fired but only logged — it never touched the document. The doc stayed `pending`, the stuck-sweep skipped `pending`, and the UI showed a perpetual "crawling" spinner.
   **Fix applied:** Added `DoclingCrawlingProcessorService.markCrawlJobFailed(payload, error)` (mirroring the `markRecordFailed` pattern already used by the csv-extraction/evaluation workers, guarded by current status so a late stall event can't clobber a doc already handled via another path), called from `docling-crawling.worker.ts`'s `@OnWorkerEvent('failed')`. Set explicit worker options tuned for long jobs (`lockDuration: 300_000`, `maxStalledCount: 3`, explicit `concurrency: 1`). Extended the stuck-sweep's status list to `["pending", "queued", "processing"]` as a backstop for any other way a document could get stranded in `pending`.

9. 🟡 **PARTIALLY FIXED (wall-clock deadline only; page cap deliberately not added, depth-limit and streaming storage deferred)** — **Unbounded in-process crawl** — `docling-crawler-client.service.ts`
   No max-page cap, no depth limit, no overall deadline (only a 30s per-goto timeout); every page's markdown accumulates in `pages[]` and the processor `JSON.stringify`s the whole array. A large same-origin site pins the concurrency-1 worker for hours and risks V8 max-string/OOM.
   **Fix applied:** Added `MAX_CRAWL_DURATION_MS` (15 min, overridable via `crawlUrl({..., maxCrawlDurationMs})`), checked at the top of the crawl loop before dequeuing each URL. Hitting it is a graceful truncation (returns whatever pages were collected, no throw), logged as a warning.
   **Explicitly not added:** a page-count cap (`MAX_PAGES`) — an initial version of this fix added one (200), but that's an arbitrary number that would truncate legitimate large documentation/marketing sites well before any real resource risk. Decided to bound crawl time only, not page count; a fast-loading, link-dense site can still produce a large `pages[]` within the time window. If that turns out to be a real problem in practice, revisit with an actual memory-based or size-based limit (e.g. total markdown bytes) rather than a guessed page count.
   **Deferred (still open):** depth limiting (marked optional in the original finding) and streaming pages to storage incrementally instead of buffering + one-shot `JSON.stringify` (a bigger architectural change to `documents.service.ts`'s content-storage shape — this is the fix that would actually address the memory-growth risk left open by dropping the page cap).

10. ✅ **FIXED** — **Browser leak on early failure** — `docling-crawler-client.service.ts`
    `launch()`, `newContext()`, and `newPage()` all ran *before* the `try` whose `finally` was the only `browser.close()`. A rejection from `newContext()`/`newPage()` orphaned the Chromium process; with `attempts=1` (no `defaultJobOptions`), leaks accumulated across user-retriggered crawls.
    **Fix applied:** `launch()` stays outside the `try` (nothing to close if it itself throws), but `newContext()`/`newPage()` were moved *inside* it, so the existing `finally { await browser.close() }` now runs on any failure after a successful launch. Added two tests covering `newContext()` and `newPage()` rejecting.

11. ✅ **FIXED** — **Duplicate crawls from fragment / start-URL dedup gaps** — `docling-crawler-client.service.ts:115`
    Dedup keys on raw hrefs with fragments intact, so `/guide#install`, `/guide#usage`, `/guide` are three entries → the same page is crawled, stored, and embedded three times. Separately, the start URL is queued as the raw `params.url` while discovered links are browser-normalized, so `https://example.com` vs `https://example.com/` re-crawls the start page.
    **Fix applied:** Added `normalizeUrl()` (strips `.hash`, returns `.href`) and used it for both the seeded start-URL queue entry and every discovered link before the `visitedUrls`/queue membership checks, so all dedup happens on the normalized form.

12. ✅ **FIXED** — **`isSamePageAnchor` ignores the query string → pagination dropped** — `docling-crawler-client.service.ts:110`
    The guard is `hash !== '' && pathname === currentPathname`. A link from `/blog` to `/blog?page=2#content` matches and is treated as an on-page anchor, so all paginated content is silently missed.
    **Fix applied:** Removed the `isSamePageAnchor`/`currentPathname` special-case entirely — now that every URL is dedup'd on its hash-stripped form (#11), a true same-page anchor normalizes to a URL already in `visitedUrls`/the queue and is naturally skipped, while a same-pathname/different-query URL like `/blog?page=2` is a distinct entry and gets enqueued.

13. ✅ **FIXED** — **Start-URL redirect re-scopes `basePath`, collapsing the crawl** — `docling-crawler-client.service.ts:67`
    `basePath` is re-derived from the first page's *post-redirect* URL. If `/` 301s to `/home`, `basePath` becomes `/home` and links to `/about`, `/pricing` fail `isUnderBasePath` — a whole-site crawl returns one page.
    **Fix applied:** `basePath` is now a `const` taken from the **requested** start URL and never reassigned; only `baseUrl` (origin) is still re-derived from the resolved post-redirect URL.

14. ✅ **FIXED** — **Asset-extension filter tests the full href, not the pathname** — `docling-crawler-client.service.ts:117`
    The `$`-anchored regex is tested against the raw href, so `…/manual.pdf?version=2` and `…/doc.pdf#page=2` bypass it (Chromium navigates the PDF), while `…/gallery#photo.png` is wrongly skipped.
    **Fix applied:** `SKIPPED_LINK_EXTENSIONS` is now tested against `parsedLink.pathname` instead of the raw `link` string.

15. ✅ **FIXED** — **Empty pages stored (spider skips them)** — `docling-crawler-client.service.ts:98`
    The spider client skips empty-content pages; the docling client pushes `{ url, markdown: '' }` and fires `onPage` anyway, inflating `pagesCrawled` and the stored content JSON.
    **Fix applied:** After conversion, pages whose trimmed markdown is empty are counted in a new `emptyPages` tally and skipped (`continue`) before `pages.push`/`onPage`, without discarding that page's already-enqueued outbound links.

---

### 🟡 Reuse, efficiency & maintainability

16. ✅ **RESOLVED (Spider removed)** — *(was: "~250 lines duplicate the url-crawling vertical verbatim")*
    Spider.cloud was removed entirely per the decision to standardize on Docling — the whole duplicated `url-crawling*` vertical (worker, processor, batch service, module, payload type) no longer exists.

17. ✅ **RESOLVED (Spider removed)** — *(was: "Frontend engine choice forked across 5 files")*
    There is only one engine/thunk now (`crawlUrlDocling`) — the Spider thunk, SPI method, API call, route, and duplicated `crawlUrl.fulfilled/rejected` middleware listeners were deleted, and the engine picker was removed from `CrawlUrlButton.tsx`.

18. ✅ **FIXED** — **O(queue) `urlQueue.includes()` per discovered link** — `docling-crawler-client.service.ts:116`
    Quadratic on large sites with repeated nav menus.
    **Fix applied:** Added a `queuedUrls: Set<string>` alongside `urlQueue`, seeded from the initial queue and updated on every push; the link-filter now checks `!queuedUrls.has(normalizedLink)` instead of `!urlQueue.includes(normalizedLink)`, giving O(1) membership checks. `urlQueue` itself stays a plain array used purely as the FIFO.

19. ✅ **FIXED** — **`goto` and `convert` awaited serially per page** — `docling-crawler-client.service.ts:95`
    Wall time = sum of (goto + convert) per page.
    **Fix applied:** `client.convert(...)` is no longer awaited inline. Each page's conversion promise is pushed onto a bounded `inFlightConversions` queue (`MAX_IN_FLIGHT_CONVERSIONS = 2`); once the bound is hit, the oldest pending conversion is drained (awaited and processed — pushed to `pages`/`onPage`, or counted as `emptyPages`/`errored`) before the crawl proceeds to navigate the next page. Any conversions still in flight after the crawl loop exits are drained in the same order. Fetching stays strictly sequential on the single Playwright `page`; only the docling-serve `convert()` call for page N now overlaps with navigation of page N+1. A docling-serve connection error (`ECONNREFUSED`) surfacing during a deferred drain still aborts the whole crawl, same as before.

20. ✅ **FIXED** — **`cancelCrawlUrl` scans all jobs instead of a `jobId` lookup** — `bull-mq-docling-crawling-batch.service.ts:24`
    O(queue) Redis reads per cancel.
    **Fix applied:** `enqueueCrawlUrl` now adds with a deterministic `{ jobId: documentId }`, matching the O(1) pattern already used in csv-extraction-runs/extraction-agent-sessions/evaluations. `cancelCrawlUrl` is now `getJob(documentId)` + a state check + `remove()` — O(1) instead of scanning every waiting/delayed/paused job.
    **Non-obvious wrinkle handled:** this queue has no `removeOnComplete`/`removeOnFail` defaults, so a job's Redis hash sticks around after it finishes, and BullMQ's `add()` silently no-ops if a job with the same `jobId` already exists. Since `reCrawlUrl` enqueues a second crawl for the *same* `documentId`, a naive deterministic-`jobId` switch would have made every recrawl after the first crawl finished silently do nothing. `enqueueCrawlUrl` now checks for an existing job first: if it's `active`, the new enqueue is skipped (logged) rather than creating a second job that would race it (a strict improvement on the concurrent-job risk in #6, though it doesn't fully resolve #6 — see there); for any other state (`completed`/`failed`/`waiting`/`delayed`), the stale job is removed before the fresh one is added, so recrawl keeps working. Added `bull-mq-docling-crawling-batch.service.spec.ts` (previously missing — also chips away at #25) covering both methods' branches.

21. ✅ **FIXED** — **`dl→ul` rewrite inline in the crawl loop, untested** — `docling-crawler-client.service.ts:76`
    Docling conversion preprocessing embedded in the crawler; the spec mocks `page.evaluate` wholesale so it has zero coverage, and it flattens `dd` via `textContent`, discarding nested links/lists.
    **Fix applied:** Extracted to a named, exported `rewriteDefinitionListsAsUnorderedLists()` in the new `docling-definition-list-rewrite.ts`, called via `page.evaluate(rewriteDefinitionListsAsUnorderedLists)`. It stays parameterless and reads the ambient `document` global on purpose — Playwright serializes and runs it inside the page, so a live `Document` can't be passed as an `evaluate` argument. `dt`/`dd` content is now preserved by cloning each child node instead of collapsing to `.textContent`, so nested markup (links, inline formatting) survives. Added `jsdom` (pinned to `26.1.0` — newer majors pull in an ESM-only transitive dep that breaks under this repo's CommonJS Jest transform) as an `apps/api` devDependency and a real spec (`docling-definition-list-rewrite.spec.ts`) driving the function against representative HTML by pointing `global.document` at a jsdom document.

22. **Dead `baseUrl`/`basePath` initializers** — `docling-crawler-client.service.ts:30`
    The pre-loop values are never read (the link filter runs only after the first iteration overwrites them).
    **Fix:** Navigate `params.url` once *before* the loop, derive `const baseUrl`/`const basePath` from the resolved `page.url()`, then run the queue loop with consts. (Combines naturally with the #13 fix.)

23. **No queue metrics for the docling queue** — `docling-crawling-workers.module.ts:31`
    Still open. The deleted spider module used to register `UrlCrawlingQueueMetricsService` (OTel gauges); the docling module has no equivalent, so a stuck backlog goes unnoticed.
    **Fix:** Add an OTel-gauge metrics service for the docling queue (the deleted `UrlCrawlingQueueMetricsService` can serve as a reference implementation to adapt).

---

### 🟢 Tests & conventions

24. **Docling batch mock omits `cancelCrawlUrl`** — `test-overrides.ts:46`
    Nothing fails today (NestJS `useValue` does no conformance check), but the moment cancel is wired to the docling service — the fix for #6 — every suite using this mock throws `cancelCrawlUrl is not a function`.
    **Fix:** Add `cancelCrawlUrl: jest.fn()` to `createDoclingCrawlingBatchServiceMock` (and the spider mock, which has the same gap). Better: type the mock as the batch-service interface so a missing method fails to compile.

25. **New batch service ships without a `*.service.spec.ts`** — `bull-mq-docling-crawling-batch.service.ts:11`
    `apps/api/CLAUDE.md` mandates one. Its spider twin also lacks one (precedent), but the PR added specs for the two other new services, so this is the gap.
    **Fix:** Add `bull-mq-docling-crawling-batch.service.spec.ts` covering `enqueueCrawlUrl` and the `cancelCrawlUrl` job-matching loop (which is otherwise untested). If the vertical is de-duplicated (#16), one spec covers both engines.

26. **Form bypasses the mandated `Form` components** — `CrawlUrlButton.tsx`
    The engine-field-specific complaint (raw `Controller` + `z.enum` picker) is moot — the engine field was deleted along with Spider. The rest of the form still uses `Field`/`FieldLabel` + `register` + a local `z.object` instead of the shared `Form`/`FormField`/`FormMessage` + an api-contracts schema, so the ADR 0012 divergence stands, just smaller now.
    **Fix:** Migrate the (now simpler, url+name only) form to `Form`/`FormField`/`FormControl`/`FormMessage` with a `zodResolver` schema exported from `@caseai-connect/api-contracts`. Low urgency.

27. **Unrelated drive-by hunks** — `apps/web/src/stories/routes/studio/AgentEditorRoute.stories.tsx:139` and `apps/help/.../VersionHistoryWalkthrough.astro`
    A whitespace-only edit and a comment-only rename belonging to the #629 agentSettings refactor.
    **Fix:** Revert both hunks from this PR; land the astro comment rename as its own small chore commit so blame/revert of the crawler feature stay clean.

---

**Suggested merge order:** the SSRF gap (#4) is must-fix; the silent-failure trio (#5, #6, #8) turns real failures into invisible ones and is close behind. Persisting the chosen engine on `Document` (#7, via the existing `extraction_engine` column) fixes recrawl *and* cancel routing (#6) at once, and collapsing the duplicated vertical (#16/#17) would have prevented most of the divergence — and folds in the metrics (#23) and spec (#25) gaps for free.

<sub>🤖 Reviewed with [Claude Code](https://claude.com/claude-code)</sub>
