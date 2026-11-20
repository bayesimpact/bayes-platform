import { Module } from "@nestjs/common"
import { PdfConverterClient } from "./pdf-converter.client"
import { PdfPagesService } from "./pdf-pages.service"

@Module({
  providers: [PdfConverterClient, PdfPagesService],
  exports: [PdfPagesService],
})
export class PdfPagesModule {}
