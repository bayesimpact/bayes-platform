.PHONY: docker

# Change detection configuration
BASE_REF ?= HEAD^1
TEST_DATABASE_URL ?= postgresql://connect_admin:passpass@localhost:5432/connect_test
TEST_ADMIN_DATABASE_URL ?= postgresql://admin:passpass@localhost:5432/postgres
TEST_MCP_ENCRYPTION_KEY ?= 0000000000000000000000000000000000000000000000000000000000000000

# Local image tags (no GCP references)
localApiImage = caseai-connect/api:local
localCpuWorkersImage = caseai-connect/cpu-workers:local
localGpuWorkersImage = caseai-connect/gpu-workers:local
smokeComposeFile = infra/docker-compose.api-workers-smoke.yaml
smokeEnv = API_IMAGE=${localApiImage} CPU_WORKERS_IMAGE=${localCpuWorkersImage} GPU_WORKERS_IMAGE=${localGpuWorkersImage}

# ==============================================================================
# Change Detection
# ==============================================================================

# Paths that affect API deployment
API_PATHS := \
	apps/api/src \
	apps/api/package.json \
	apps/api/nest-cli.json \
	apps/api/tsconfig.json \
	apps/api/Dockerfile \
	apps/api/requirements-torch.txt \
	apps/api/requirements-docling.txt \
	packages/api-contracts \
	package.json \
	package-lock.json \
	turbo.json

# Patterns that should NOT trigger deployment (extended regex format)
API_EXCLUDE_PATTERNS := \.md$$|\.spec\.ts$$|\.e2e-spec\.ts$$|apps/api/test/|apps/api/README\.md

# Check if API has meaningful changes
check-api-changes:
	@echo "Checking for API changes between $(BASE_REF) and HEAD..."
	@CHANGED=$$(git diff --name-only $(BASE_REF) HEAD -- $(API_PATHS) | \
		grep -v -E '$(API_EXCLUDE_PATTERNS)' || true); \
	if [ -n "$$CHANGED" ]; then \
		echo "✓ API changes detected:"; \
		echo "$$CHANGED" | sed 's/^/  - /'; \
		exit 0; \
	else \
		echo "✗ No API changes detected (skipping deployment)"; \
		exit 1; \
	fi

# Check if frontend has meaningful changes (for future use)
check-web-changes:
	@echo "Checking for web changes between $(BASE_REF) and HEAD..."
	@CHANGED=$$(git diff --name-only $(BASE_REF) HEAD -- apps/web packages/ui | \
		grep -v -E '\.md$$|\.spec\.ts$$|\.test\.ts$$' || true); \
	if [ -n "$$CHANGED" ]; then \
		echo "✓ Web changes detected:"; \
		echo "$$CHANGED" | sed 's/^/  - /'; \
		exit 0; \
	else \
		echo "✗ No web changes detected"; \
		exit 1; \
	fi

# ==============================================================================
# Docker & Deployment
# ==============================================================================

trivy-scan: docker-build
	trivy image --ignore-unfixed --pkg-types os,library --severity CRITICAL,HIGH --ignorefile .trivyignore.yaml ${localApiImage}
	trivy image --ignore-unfixed --pkg-types os,library --severity CRITICAL,HIGH --ignorefile .trivyignore.yaml ${localCpuWorkersImage}
	trivy image --ignore-unfixed --pkg-types os,library --severity CRITICAL,HIGH --ignorefile .trivyignore.yaml ${localGpuWorkersImage}

docker-build: docker-build-api docker-build-cpu-workers docker-build-gpu-workers

docker-build-api:
	docker build --platform=linux/amd64 --target api-runtime -t ${localApiImage} -f apps/api/Dockerfile .

docker-build-cpu-workers:
	docker build --platform=linux/amd64 --target cpu-workers-runtime -t ${localCpuWorkersImage} -f apps/api/Dockerfile .

docker-build-gpu-workers:
	docker build --platform=linux/amd64 --target gpu-workers-runtime -t ${localGpuWorkersImage} -f apps/api/Dockerfile .

BUILDX_CACHE_DIR = /tmp/.buildx-cache

docker-build-cached: docker-build-cached-api docker-build-cached-cpu-workers docker-build-cached-gpu-workers

docker-build-cached-api:
	docker buildx build --platform=linux/amd64 --target api-runtime -t ${localApiImage} -f apps/api/Dockerfile --cache-from type=local,src=${BUILDX_CACHE_DIR}/api --cache-to type=local,dest=${BUILDX_CACHE_DIR}/api-new,mode=max --load .
	rm -rf ${BUILDX_CACHE_DIR}/api && mv ${BUILDX_CACHE_DIR}/api-new ${BUILDX_CACHE_DIR}/api

docker-build-cached-cpu-workers:
	docker buildx build --platform=linux/amd64 --target cpu-workers-runtime -t ${localCpuWorkersImage} -f apps/api/Dockerfile --cache-from type=local,src=${BUILDX_CACHE_DIR}/cpu --cache-to type=local,dest=${BUILDX_CACHE_DIR}/cpu-new,mode=max --load .
	rm -rf ${BUILDX_CACHE_DIR}/cpu && mv ${BUILDX_CACHE_DIR}/cpu-new ${BUILDX_CACHE_DIR}/cpu

docker-build-cached-gpu-workers:
	docker buildx build --platform=linux/amd64 --target gpu-workers-runtime -t ${localGpuWorkersImage} -f apps/api/Dockerfile --cache-from type=local,src=${BUILDX_CACHE_DIR}/gpu --cache-to type=local,dest=${BUILDX_CACHE_DIR}/gpu-new,mode=max --load .
	rm -rf ${BUILDX_CACHE_DIR}/gpu && mv ${BUILDX_CACHE_DIR}/gpu-new ${BUILDX_CACHE_DIR}/gpu

docker-check: docker-build-api
	@echo "Starting docker container and checking for successful startup..."
	@CONTAINER_ID=$$(docker run -d -p "3003:3000" ${localApiImage}); \
	echo "Container ID: $$CONTAINER_ID"; \
	i=1; \
	while [ $$i -le 30 ]; do \
		echo "Checking logs (attempt $$i/30)..."; \
		LOGS=$$(docker logs $$CONTAINER_ID 2>&1); \
		echo "$$LOGS"; \
		if echo "$$LOGS" | grep -q "Starting Nest application..."; then \
			echo "✓ Docker container started successfully"; \
			docker kill $$CONTAINER_ID >/dev/null 2>&1; \
			exit 0; \
		fi; \
		sleep 1; \
		i=$$((i + 1)); \
	done; \
	echo "✗ Failed to find 'Starting Nest application...' in docker logs"; \
	docker kill $$CONTAINER_ID >/dev/null 2>&1; \
	exit 1

# Smoke-tests both worker images. GPU must ship Docling; CPU must boot without it.
docker-workers-check: docker-gpu-workers-check docker-cpu-workers-check

docker-gpu-workers-check: docker-build-gpu-workers
	@echo "Starting GPU workers (Docling) with smoke dependencies and checking for successful startup..."
	@$(smokeEnv) docker compose -f ${smokeComposeFile} up -d postgres redis gpu-workers; \
	CONTAINER_ID=$$($(smokeEnv) docker compose -f ${smokeComposeFile} ps -q gpu-workers); \
	echo "Container ID: $$CONTAINER_ID"; \
	echo "Verifying Docling CLI in GPU workers container..."; \
	j=1; \
	DOC_VERSION=""; \
	while [ $$j -le 15 ]; do \
		DOC_VERSION=$$(docker exec $$CONTAINER_ID docling --version 2>/dev/null || true); \
		if [ -n "$$DOC_VERSION" ]; then \
			echo "✓ Docling CLI available: $$DOC_VERSION"; \
			break; \
		fi; \
		if ! docker ps -q --no-trunc | grep -q "$$CONTAINER_ID"; then \
			echo "✗ GPU workers container exited before Docling CLI check completed"; \
			docker logs $$CONTAINER_ID 2>&1; \
			$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
			exit 1; \
		fi; \
		sleep 1; \
		j=$$((j + 1)); \
	done; \
	if [ -z "$$DOC_VERSION" ]; then \
		echo "✗ Docling CLI check failed in GPU workers container"; \
		docker logs $$CONTAINER_ID 2>&1; \
		$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
		exit 1; \
	fi; \
	i=1; \
	while [ $$i -le 45 ]; do \
		echo "Checking logs (attempt $$i/45)..."; \
		LOGS=$$(docker logs $$CONTAINER_ID 2>&1); \
		echo "$$LOGS"; \
		if echo "$$LOGS" | grep -q "Workers app started"; then \
			echo "✓ GPU workers container started successfully"; \
			$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
			exit 0; \
		fi; \
		sleep 1; \
		i=$$((i + 1)); \
	done; \
	echo "✗ Failed to find 'Workers app started' in GPU workers logs"; \
	$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
	exit 1

docker-cpu-workers-check: docker-build-cpu-workers
	@echo "Starting CPU workers (no Docling) with smoke dependencies and checking for successful startup..."
	@$(smokeEnv) docker compose -f ${smokeComposeFile} up -d postgres redis cpu-workers; \
	CONTAINER_ID=$$($(smokeEnv) docker compose -f ${smokeComposeFile} ps -q cpu-workers); \
	echo "Container ID: $$CONTAINER_ID"; \
	echo "Verifying Docling is absent from CPU workers container..."; \
	if docker exec $$CONTAINER_ID sh -c 'command -v docling' >/dev/null 2>&1; then \
		echo "✗ Docling unexpectedly present in CPU workers image"; \
		$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
		exit 1; \
	fi; \
	echo "✓ Docling not installed in CPU workers image"; \
	i=1; \
	while [ $$i -le 45 ]; do \
		echo "Checking logs (attempt $$i/45)..."; \
		LOGS=$$(docker logs $$CONTAINER_ID 2>&1); \
		echo "$$LOGS"; \
		if echo "$$LOGS" | grep -q "Workers app started"; then \
			echo "✓ CPU workers container started successfully"; \
			$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
			exit 0; \
		fi; \
		if ! docker ps -q --no-trunc | grep -q "$$CONTAINER_ID"; then \
			echo "✗ CPU workers container exited before startup completed"; \
			docker logs $$CONTAINER_ID 2>&1; \
			$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
			exit 1; \
		fi; \
		sleep 1; \
		i=$$((i + 1)); \
	done; \
	echo "✗ Failed to find 'Workers app started' in CPU workers logs"; \
	$(smokeEnv) docker compose -f ${smokeComposeFile} down -v >/dev/null 2>&1; \
	exit 1

docker-smoke-up: docker-build
	$(smokeEnv) docker compose -f ${smokeComposeFile} up -d --build

docker-smoke-ps:
	$(smokeEnv) docker compose -f ${smokeComposeFile} ps

docker-smoke-logs:
	$(smokeEnv) docker compose -f ${smokeComposeFile} logs --tail=200 api cpu-workers gpu-workers postgres redis

docker-smoke-check: docker-smoke-up
	@echo "Waiting for services to settle..."
	@sleep 8
	@$(smokeEnv) docker compose -f ${smokeComposeFile} ps
	@if $(smokeEnv) docker compose -f ${smokeComposeFile} ps --status exited | grep -Eq "api|workers"; then \
		echo "✗ API or workers exited unexpectedly. Check logs with: make docker-smoke-logs"; \
		exit 1; \
	fi
	@echo "✓ API and workers are still running"

docker-smoke-down:
	$(smokeEnv) docker compose -f ${smokeComposeFile} down -v

# ==============================================================================
# Web-embed deployment
# ==============================================================================

WEB_EMBED_BUCKET ?= eu-connect-agent-embed

deploy-web-embed:
	@echo "→ Building web-embed SPA..."
	cd apps/web-embed && npm run build
	@echo "→ Building launcher..."
	cd apps/web-embed && npm run build:launcher
	@echo "→ Uploading hashed assets (1 year cache)..."
	gsutil -m -h "Cache-Control:public, max-age=31536000" cp -r apps/web-embed/dist/assets/* gs://$(WEB_EMBED_BUCKET)/assets/
	@echo "→ Uploading launcher.js (5 min cache)..."
	gsutil -h "Cache-Control:public, max-age=300" cp apps/web-embed/dist-launcher/launcher.iife.js gs://$(WEB_EMBED_BUCKET)/launcher.js
	@echo "→ Uploading index.html (no cache)..."
	gsutil -h "Cache-Control:no-cache" cp apps/web-embed/dist/index.html gs://$(WEB_EMBED_BUCKET)/index.html
	@echo "✓ web-embed deployed to https://storage.googleapis.com/$(WEB_EMBED_BUCKET)/"

npm-ci:
	@if [ -f node_modules/.package-lock-hash ] && [ "$$(cat node_modules/.package-lock-hash)" = "$$(sha256sum package-lock.json | cut -d' ' -f1)" ]; then \
		echo "package-lock.json unchanged, skipping npm ci"; \
	else \
		npm ci && sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.package-lock-hash; \
	fi

ci-checks: npm-ci
	npm run biome:ci && npm run typecheck && npm run check:boundaries

db-tests:
	docker compose -f infra/database/docker-compose.yaml -f infra/database/docker-compose.test.yaml up -d

tests: db-tests ci-checks
	cd apps/api && DATABASE_URL=${TEST_DATABASE_URL} MCP_ENCRYPTION_KEY=${TEST_MCP_ENCRYPTION_KEY} npm run migration:test:run && DATABASE_URL=${TEST_DATABASE_URL} MCP_ENCRYPTION_KEY=${TEST_MCP_ENCRYPTION_KEY} npm run test

tests-parallel: db-tests ci-checks
	cd apps/api && DATABASE_URL=${TEST_DATABASE_URL} MCP_ENCRYPTION_KEY=${TEST_MCP_ENCRYPTION_KEY} npm run migration:test:run && TEST_ADMIN_DATABASE_URL=${TEST_ADMIN_DATABASE_URL} TEST_MAX_WORKERS=${TEST_MAX_WORKERS} DATABASE_URL=${TEST_DATABASE_URL} MCP_ENCRYPTION_KEY=${TEST_MCP_ENCRYPTION_KEY} npm run test:parallel

tests-only-parallel: npm-ci db-tests
	cd apps/api && DATABASE_URL=${TEST_DATABASE_URL} MCP_ENCRYPTION_KEY=${TEST_MCP_ENCRYPTION_KEY} npm run migration:test:run && TEST_ADMIN_DATABASE_URL=${TEST_ADMIN_DATABASE_URL} TEST_MAX_WORKERS=${TEST_MAX_WORKERS} DATABASE_URL=${TEST_DATABASE_URL} MCP_ENCRYPTION_KEY=${TEST_MCP_ENCRYPTION_KEY} npm run test:parallel
