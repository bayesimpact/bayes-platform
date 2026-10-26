import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Put,
  Req,
} from "@nestjs/common"
import type { Request } from "express"
import type { IFileStorage } from "./file-storage.interface"
import { FILE_STORAGE_SERVICE } from "./file-storage.interface"
// biome-ignore lint/style/useImportType: not a type
import {
  LocalStorageService,
  UploadSizeMismatchError,
  UploadTooLargeError,
} from "./local-storage.service"

@Controller()
export class LocalPresignUploadController {
  constructor(@Inject(FILE_STORAGE_SERVICE) private readonly storage: IFileStorage) {}

  @Put("local-presign-upload/:token")
  @HttpCode(HttpStatus.OK)
  async upload(@Param("token") token: string, @Req() req: Request): Promise<void> {
    const localStorage = this.storage as LocalStorageService
    if (typeof localStorage.handleLocalUpload !== "function") {
      throw new BadRequestException("Local presign upload is not available in this environment.")
    }
    try {
      const fileBuffer = await localStorage.readUploadBody(token, req)
      await localStorage.handleLocalUpload(token, fileBuffer)
    } catch (error) {
      if (error instanceof UploadSizeMismatchError || error instanceof UploadTooLargeError) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }
}
