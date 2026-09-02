import { Module } from '@nestjs/common';
import { BaseModule } from './base/base.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { ScimTokenModule } from './scim/scim.module';
import { SecurityModule } from './security/security.module';
import { AuditModule } from './audit/audit.module';
import { MfaModule } from './mfa/mfa.module';

@Module({
  imports: [BaseModule, ApiKeyModule, ScimTokenModule, SecurityModule, AuditModule, MfaModule],
})
export class EeModule {}
