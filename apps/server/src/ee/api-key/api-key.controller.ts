import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto, ListApiKeysDto, RevokeApiKeyDto, UpdateApiKeyDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly service: ApiKeyService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  list(@AuthWorkspace() workspace: Workspace, @Body() body: ListApiKeysDto) {
    return this.service.list(workspace.id, body ?? {});
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  create(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: CreateApiKeyDto) {
    return this.service.create(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: UpdateApiKeyDto) {
    return this.service.update(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  revoke(@AuthWorkspace() workspace: Workspace, @Body() body: RevokeApiKeyDto) {
    return this.service.revoke(workspace.id, body.apiKeyId);
  }
}
