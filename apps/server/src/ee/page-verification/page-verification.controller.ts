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
import { PageVerificationService } from './page-verification.service';
import {
  ListVerificationsDto,
  PageIdDto,
  RejectApprovalDto,
  SetupVerificationDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageVerificationController {
  constructor(private readonly service: PageVerificationService) {}

  @HttpCode(HttpStatus.OK)
  @Post('verification-info')
  info(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: PageIdDto) {
    return this.service.info(workspace.id, user.id, body.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create-verification')
  create(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: SetupVerificationDto) {
    return this.service.create(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-verification')
  update(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: SetupVerificationDto) {
    return this.service.update(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete-verification')
  remove(@AuthWorkspace() workspace: Workspace, @Body() body: PageIdDto) {
    return this.service.remove(workspace.id, body.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify')
  verify(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: PageIdDto) {
    return this.service.verify(workspace.id, user.id, body.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('submit-for-approval')
  submit(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: PageIdDto) {
    return this.service.submitForApproval(workspace.id, user.id, body.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reject-approval')
  reject(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: RejectApprovalDto) {
    return this.service.rejectApproval(workspace.id, user.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-obsolete')
  obsolete(@AuthWorkspace() workspace: Workspace, @Body() body: PageIdDto) {
    return this.service.markObsolete(workspace.id, body.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verifications')
  list(@AuthWorkspace() workspace: Workspace, @Body() body: ListVerificationsDto) {
    return this.service.list(workspace.id, body ?? {});
  }
}
