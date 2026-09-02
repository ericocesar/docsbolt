import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { ScimTokenService } from './scim.service';
import { CreateScimTokenDto, ListScimTokensDto, RevokeScimTokenDto, UpdateScimTokenDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('scim-tokens')
export class ScimTokenController {
  constructor(private readonly service: ScimTokenService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  list(@AuthWorkspace() workspace: Workspace, @Body() body: ListScimTokensDto) {
    return this.service.list(workspace.id, body ?? {});
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  create(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: CreateScimTokenDto) {
    return this.service.create(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: UpdateScimTokenDto) {
    return this.service.update(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  revoke(@AuthWorkspace() workspace: Workspace, @Body() body: RevokeScimTokenDto) {
    return this.service.revoke(workspace.id, body.tokenId);
  }
}
