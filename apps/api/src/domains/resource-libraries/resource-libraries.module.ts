import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceLibraryContextResolver } from "@/common/context/resolvers/resource-library-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { UsersModule } from "@/domains/users/users.module"
import { ResourceLibrariesController } from "./resource-libraries.controller"
import { ResourceLibrariesService } from "./resource-libraries.service"
import { ResourceLibrary } from "./resource-library.entity"
import { ResourceLibraryGuard } from "./resource-library.guard"
import { ResourceLibraryFilesController } from "./resource-library-files.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([ResourceLibrary, Project]),
    OrganizationsModule,
    forwardRef(() => ProjectsModule),
    UsersModule,
    AuthModule,
    StorageModule,
  ],
  providers: [
    ResourceLibrariesService,
    ResourceLibraryGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    ResourceLibraryContextResolver,
  ],
  controllers: [ResourceLibrariesController, ResourceLibraryFilesController],
  exports: [ResourceLibrariesService],
})
export class ResourceLibrariesModule {}
