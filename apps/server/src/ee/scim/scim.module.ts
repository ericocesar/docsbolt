import { Module } from '@nestjs/common';
import { ScimTokenController } from './scim.controller';
import { ScimTokenService } from './scim.service';

@Module({
  controllers: [ScimTokenController],
  providers: [ScimTokenService],
  exports: [ScimTokenService],
})
export class ScimTokenModule {}
