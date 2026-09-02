import { Module } from '@nestjs/common';
import { BaseModule } from './base/base.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { ScimTokenModule } from './scim/scim.module';

@Module({
  imports: [BaseModule, ApiKeyModule, ScimTokenModule],
})
export class EeModule {}
