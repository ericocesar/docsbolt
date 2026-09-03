import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiChatRepo } from './ai-chat.repo';
import { EmbeddingsModule } from '../ai/embeddings/embeddings.module';
import { EnvironmentModule } from '../../integrations/environment/environment.module';

@Module({
  imports: [EmbeddingsModule, EnvironmentModule],
  controllers: [AiChatController],
  providers: [AiChatService, AiChatRepo],
  exports: [AiChatService],
})
export class AiChatModule {}
