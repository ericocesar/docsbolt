import { Module } from '@nestjs/common';
import { BaseModule } from './base/base.module';
import { ApiKeyModule } from './api-key/api-key.module';

@Module({
  imports: [BaseModule, ApiKeyModule],
})
export class EeModule {}
