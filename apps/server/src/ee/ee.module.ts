import { Module } from '@nestjs/common';
import { BaseModule } from './base/base.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { ScimTokenModule } from './scim/scim.module';
import { SecurityModule } from './security/security.module';
import { AuditModule } from './audit/audit.module';
import { MfaModule } from './mfa/mfa.module';
import { PageVerificationModule } from './page-verification/page-verification.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { EmbeddingsModule } from './ai/embeddings/embeddings.module';

@Module({
  imports: [
    BaseModule,
    ApiKeyModule,
    ScimTokenModule,
    SecurityModule,
    AuditModule,
    MfaModule,
    PageVerificationModule,
    AiChatModule,
    EmbeddingsModule,
  ],
})
export class EeModule {}
