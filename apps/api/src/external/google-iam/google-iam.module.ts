import { Module } from "@nestjs/common"
import { GoogleIdTokenService } from "./google-id-token.service"

@Module({
  providers: [GoogleIdTokenService],
  exports: [GoogleIdTokenService],
})
export class GoogleIamModule {}
