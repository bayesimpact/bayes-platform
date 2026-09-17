import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ConversationForm } from "./conversation-form.entity"
import { ConversationFormsService } from "./conversation-forms.service"

@Module({
  imports: [TypeOrmModule.forFeature([ConversationForm])],
  providers: [ConversationFormsService],
  exports: [ConversationFormsService],
})
export class ConversationFormsModule {}
