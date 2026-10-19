import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ConversationForm } from "./conversation-form.entity"
import { ConversationFormRepository } from "./conversation-form.repository"
import { ConversationFormsService } from "./conversation-forms.service"

@Module({
  imports: [TypeOrmModule.forFeature([ConversationForm])],
  providers: [ConversationFormRepository, ConversationFormsService],
  exports: [ConversationFormRepository, ConversationFormsService],
})
export class ConversationFormsModule {}
