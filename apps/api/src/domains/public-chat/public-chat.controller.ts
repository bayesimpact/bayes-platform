import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicChatService } from "./public-chat.service"

/**
 * Base of the public chat API controllers, a versioned contract with external
 * integrators (`docs/public-api-contract.md`).
 *
 * Each served contract has its own folder and controller extending this class:
 * `v1/` (`/public/v1/...`) and `legacy/` (the unprefixed pre-versioning alias). Every
 * controller carries the full body of each of its routes and its own DTO mappers,
 * so a version can change without touching another. Nothing is shared here but
 * the injected service, which returns entities, never DTOs.
 *
 * Before adding a `v2/` folder, follow the "Shipping a new major version" checklist
 * in `docs/public-api-contract.md`: the DTOs and route definitions must be split per
 * major in `api-contracts` first, or the new mappers will silently change what v1 serves.
 *
 * This class declares no routes and no guards and is not registered in the module.
 * `@Injectable()` only makes TypeScript emit the constructor metadata the subclasses
 * inherit for dependency injection.
 */
@Injectable()
export abstract class PublicChatController {
  constructor(protected readonly publicChatService: PublicChatService) {}
}
