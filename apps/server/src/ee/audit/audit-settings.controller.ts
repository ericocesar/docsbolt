import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { AuditSettingsService } from './audit-settings.service';

class UpdateRetentionDto {
  @IsInt()
  @Min(1)
  @Max(3650)
  auditRetentionDays: number;
}

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditSettingsController {
  constructor(private readonly service: AuditSettingsService) {}

  @HttpCode(HttpStatus.OK)
  @Post('retention')
  get(@AuthWorkspace() workspace: Workspace) {
    return this.service.getRetention(workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('retention/update')
  update(
    @AuthWorkspace() workspace: Workspace,
    @Body() body: UpdateRetentionDto,
  ) {
    return this.service.updateRetention(workspace.id, body.auditRetentionDays);
  }
}
