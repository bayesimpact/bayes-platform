import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ThrottlerModule } from "@nestjs/throttler"
import { AppsModule } from "@/domains/apps/apps.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { ClientMetadataDocumentFetcher } from "./client-metadata-document.fetcher"
import { OAuthAccessTokenGuard } from "./oauth-access-token.guard"
import { OAuthAppClientsController } from "./oauth-app-clients.controller"
import { OAuthAuthorizationService } from "./oauth-authorization.service"
import { OAuthAuthorizationCodeRepository } from "./oauth-authorization-code.repository"
import { OAuthClientRepository } from "./oauth-client.repository"
import { OAuthClientsService } from "./oauth-clients.service"
import { OAuthConsentController } from "./oauth-consent.controller"
import { OAuthGrantRepository } from "./oauth-grant.repository"
import { OAuthMetadataController } from "./oauth-metadata.controller"
import { OAuthProtocolController } from "./oauth-protocol.controller"
import { OAuthRefreshTokenRepository } from "./oauth-refresh-token.repository"
import { buildOAuthThrottlerOptions } from "./oauth-throttling"

/** The API's OAuth authorization server, for MCP clients (ADR 0028) and apps (ADR 0029). */
@Module({
  imports: [
    ConfigModule,
    // Global config, but only the OAuth controllers put the throttler guard on.
    ThrottlerModule.forRootAsync({ useFactory: () => buildOAuthThrottlerOptions() }),
    AppsModule,
    AuthModule,
    ProjectsModule,
    RbacModule,
    UsersModule,
  ],
  controllers: [
    OAuthProtocolController,
    OAuthConsentController,
    OAuthMetadataController,
    OAuthAppClientsController,
  ],
  providers: [
    ClientMetadataDocumentFetcher,
    OAuthAccessTokenGuard,
    OAuthAuthorizationService,
    OAuthAuthorizationCodeRepository,
    OAuthClientRepository,
    OAuthClientsService,
    OAuthGrantRepository,
    OAuthRefreshTokenRepository,
  ],
  exports: [OAuthAccessTokenGuard, OAuthAuthorizationService, OAuthClientRepository],
})
export class OAuthModule {}
