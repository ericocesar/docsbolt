import { Module } from '@nestjs/common';
import { BaseService } from './base.service';
import { BaseController } from './base.controller';
import { LicenseController } from './license.controller';
import { EeStubController } from './ee-stubs.controller';
import { PageRepo } from '../../database/repos/page/page.repo';

@Module({
  providers: [BaseService, PageRepo],
  controllers: [BaseController, LicenseController, EeStubController],
  exports: [BaseService],
})
export class BaseModule {}
