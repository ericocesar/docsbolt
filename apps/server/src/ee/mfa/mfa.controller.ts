import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { MfaService } from './mfa.service';
import {
  DisableMfaDto,
  EnableMfaDto,
  RegenerateBackupCodesDto,
  SetupMfaDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller('mfa')
export class MfaController {
  constructor(private readonly service: MfaService) {}

  @HttpCode(HttpStatus.OK)
  @Post('status')
  status(@AuthUser() user: User) {
    return this.service.status(user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('setup')
  setup(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: SetupMfaDto,
  ) {
    return this.service.setup(user.id, workspace.id, user.email);
  }

  @HttpCode(HttpStatus.OK)
  @Post('enable')
  enable(@AuthUser() user: User, @Body() body: EnableMfaDto) {
    return this.service.enable(user.id, body.verificationCode);
  }

  @HttpCode(HttpStatus.OK)
  @Post('disable')
  disable(@AuthUser() user: User, @Body() body: DisableMfaDto) {
    return this.service.disable(user.id, body.confirmPassword);
  }

  @HttpCode(HttpStatus.OK)
  @Post('generate-backup-codes')
  regenerate(
    @AuthUser() user: User,
    @Body() body: RegenerateBackupCodesDto,
  ) {
    return this.service.regenerateBackupCodes(user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('validate-access')
  validateAccess() {
    return this.service.validateAccess();
  }
}
