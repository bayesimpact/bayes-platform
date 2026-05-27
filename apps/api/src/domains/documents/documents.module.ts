import { join } from "node:path"
import { forwardRef, Module } from "@nestjs/common"
import { ServeStaticModule } from "@nestjs/serve-static"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DocumentContextResolver } from "@/common/context/resolvers/document-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { UsersModule } from "@/domains/users/users.module"
import { CrawlingController } from "./crawling/crawling.controller"
import { DocumentCrawlProgressStreamService } from "./crawling/document-crawl-progress-stream.service"
import { UrlCrawlingBatchModule } from "./crawling/url-crawling-batch.module"
import { Document } from "./document.entity"
import { DocumentsController } from "./documents.controller"
import { DocumentsGuard } from "./documents.guard"
import { DocumentsService } from "./documents.service"
import { DocumentChunkRetrievalService } from "./embeddings/document-chunk-retrieval.service"
import { DocumentEmbeddingStatusNotifierService } from "./embeddings/document-embedding-status-notifier.service"
import { DocumentEmbeddingStatusStreamService } from "./embeddings/document-embedding-status-stream.service"
import { DocumentEmbeddingsBatchModule } from "./embeddings/document-embeddings-batch.module"
import { LocalPresignUploadController } from "./storage/local-presign-upload.controller"
import { StorageModule } from "./storage/storage.module"
import { DocumentTagsModule } from "./tags/document-tags.module"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      Project,
      Organization,
      OrganizationMembership,
      ProjectMembership,
    ]),
    forwardRef(() => DocumentTagsModule),
    // Only serve static files in development/local environment
    ...(process.env.NODE_ENV !== "production"
      ? [
          ServeStaticModule.forRoot({
            // Expose files (e.g., 'http://localhost:API_PORT/documents/orgId/projectId/documentId.pdf')
            serveRoot: "/documents/",
            serveStaticOptions: {
              cacheControl: true,
              maxAge: "1d",
            },
            rootPath: join(process.cwd(), "dontsave_documents"),
          }),
        ]
      : []),
    OrganizationsModule,
    forwardRef(() => ProjectsModule),
    UsersModule,
    AuthModule,
    StorageModule,
    DocumentEmbeddingsBatchModule,
    UrlCrawlingBatchModule,
    UrlCrawlingBatchModule,
  ],
  providers: [
    DocumentsService,
    DocumentEmbeddingStatusStreamService,
    DocumentEmbeddingStatusNotifierService,
    DocumentCrawlProgressStreamService,
    DocumentEmbeddingStatusNotifierService,
    DocumentCrawlProgressStreamService,
    DocumentChunkRetrievalService,
    DocumentsGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    DocumentContextResolver,
  ],
  controllers: [
    DocumentsController,
    CrawlingController,
    ...(process.env.NODE_ENV !== "production" ? [LocalPresignUploadController] : []),
  ],
  exports: [DocumentsService, DocumentChunkRetrievalService],
})
export class DocumentsModule {}
