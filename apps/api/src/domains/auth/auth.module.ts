import { Module } from "@nestjs/common"
import { PassportModule } from "@nestjs/passport"
import { JwtStrategy } from "./jwt.strategy"
import { OidcDiscoveryService } from "./oidc-discovery.service"
import { OidcUserInfoService } from "./oidc-userinfo.service"

@Module({
  imports: [PassportModule.register({ defaultStrategy: "jwt" })],
  providers: [JwtStrategy, OidcDiscoveryService, OidcUserInfoService],
  exports: [PassportModule, OidcUserInfoService],
})
export class AuthModule {}
