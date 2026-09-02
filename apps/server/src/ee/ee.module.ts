import { Module } from '@nestjs/common';
import { BaseModule } from './base/base.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { ScimTokenModule } from './scim/scim.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [BaseModule, ApiKeyModule, ScimTokenModule, SecurityModule],
})
export class EeModule {}
