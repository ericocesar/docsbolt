import { Module } from '@nestjs/common';
import { AuditSettingsController } from './audit-settings.controller';
import { AuditSettingsService } from './audit-settings.service';

@Module({
  controllers: [AuditSettingsController],
  providers: [AuditSettingsService],
  exports: [AuditSettingsService],
})
export class AuditModule {}
