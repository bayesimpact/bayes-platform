import { Module } from "@nestjs/common"
import { GoogleIamModule } from "@/external/google-iam"
import { PdfConverterClient } from "./pdf-converter.client"
import { PdfPagesService } from "./pdf-pages.service"

@Module({
  imports: [GoogleIamModule],
  providers: [PdfConverterClient, PdfPagesService],
  exports: [PdfPagesService],
})
export class PdfPagesModule {}
