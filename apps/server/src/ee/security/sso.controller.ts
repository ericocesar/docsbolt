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
import { SsoService } from './sso.service';
import {
  CreateSsoProviderDto,
  ProviderIdDto,
  UpdateSsoProviderDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller('sso')
export class SsoController {
  constructor(private readonly service: SsoService) {}

  @HttpCode(HttpStatus.OK)
  @Post('providers')
  list(@AuthWorkspace() workspace: Workspace) {
    return this.service.list(workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  info(@AuthWorkspace() workspace: Workspace) {
    return this.service.info(workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  create(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: CreateSsoProviderDto,
  ) {
    return this.service.create(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(
    @AuthWorkspace() workspace: Workspace,
    @Body() body: UpdateSsoProviderDto,
  ) {
    return this.service.update(workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  delete(
    @AuthWorkspace() workspace: Workspace,
    @Body() body: ProviderIdDto,
  ) {
    return this.service.delete(workspace.id, body.providerId);
  }
}
