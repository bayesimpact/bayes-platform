import { Module } from "@nestjs/common"
import { GoogleIamModule } from "@/external/google-iam"
import { McpClientService } from "./mcp-client.service"

@Module({
  imports: [GoogleIamModule],
  providers: [McpClientService],
  exports: [McpClientService],
})
export class McpModule {}
