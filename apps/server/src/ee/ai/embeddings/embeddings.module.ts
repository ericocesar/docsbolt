import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsRepo } from './embeddings.repo';
import { OpenAICompatibleProviderFactory } from '../providers/openai-compatible.provider';
import { EnvironmentModule } from '../../../integrations/environment/environment.module';

@Module({
  imports: [EnvironmentModule],
  providers: [EmbeddingsService, EmbeddingsRepo, OpenAICompatibleProviderFactory],
  exports: [EmbeddingsService, EmbeddingsRepo, OpenAICompatibleProviderFactory],
})
export class EmbeddingsModule {}
